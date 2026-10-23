"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Calendar, FileSpreadsheet, FileText, Printer, UserPlus, Users, FileSignature,
  RefreshCw, Info,
} from "lucide-react";
import {
  MONTHS, DAYS_FULL, type Department, type Personnel, type TimesheetEntry, type Holiday,
  type ShiftSchedule, type WeeklyOverride, type LeaveRequest, type PersonnelType,
  dayName, isWeekendDay, isWeeklyRestDay, buildWeeks, requiredDailyHours, fmtDate,
  personnelInDepartment, slotByKey, isNightRange, LEAVE_CODE_MAP,
  PERSONNEL_TYPE_META, cyclePersonnelType,
} from "@/lib/shared";
import { staffGroupMeta, type StaffGroup } from "@/lib/shared";
import { getShiftMetrics, normalizeShiftCode, isKnownCode, getShiftRangeMetrics } from "@/lib/puantaj-engine";
import { Btn, Spinner } from "@/components/ui-kit";
import { downloadFromApi } from "@/lib/download";

import { AddPersonnelModal, PersonnelManageModal, SignatureModal } from "@/components/modals";
import PrintArea, { openPrintPreview } from "@/components/PrintArea";
import PrintOptionsModal from "@/components/PrintOptionsModal";

// ─────────────────────────────────────────────
// Puantaj hücre girişi (kod veya saat — kaynak ShiftCodeCell)
// ─────────────────────────────────────────────
function ShiftCodeCell({ value, disabled, onCommit, title, className }: {
  value: string; disabled: boolean; onCommit: (val: string) => void; title: string; className: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      type="text"
      value={draft}
      title={title}
      disabled={disabled}
      maxLength={5}
      onChange={e => setDraft(e.target.value.toUpperCase().replace(/[^0-9A-ZİÜÖÇĞŞ.,]/g, ""))}
      onBlur={() => {
        const normalized = draft.trim().replace(",", ".").toUpperCase();
        setDraft(normalized);
        if (normalized !== value) onCommit(normalized);
      }}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={className}
    />
  );
}

function grossHours(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh + em / 60) - (sh + sm / 60);
  if (diff <= 0) diff += 24;
  return diff;
}

export default function PuantajPage({
  departments, personnel, holidays, selectedDept, year, month,
  onPersonnelChanged,
  onDepartmentUpdated,
  staffGroup = "SAGLIK",
}: {
  departments: Department[];
  personnel: Personnel[];
  holidays: Holiday[];
  selectedDept: string;
  year: number; month: number;
  onPersonnelChanged: () => Promise<void> | void;
  onDepartmentUpdated?: (d: Department) => void;
  /** Hemşire/Sağlık veya Temizlik/Destek — puantaj ve çıktılar bu gruba aittir */
  staffGroup?: StaffGroup;
}) {
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [scheds, setScheds] = useState<ShiftSchedule[]>([]);
  const [overrides, setOverrides] = useState<WeeklyOverride[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWeek, setActiveWeek] = useState(0);
  // Görünüm: tek hafta ya da tüm ay (bütün haftalar + ay sonu özeti tek tabloda)
  const [viewMode, setViewMode] = useState<"hafta" | "ay">("hafta");
  const [showAdd, setShowAdd] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showSig, setShowSig] = useState(false);
  // Yazdırma: bölüm seçimleri + dipnot (önizleme açılmadan sorulur)
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOpts, setPrintOpts] = useState<Record<string, boolean>>({ weekly: true, monthly: true, signatures: true });
  const [printNote, setPrintNote] = useState("");
  const [deptList, setDeptList] = useState<Department[]>(departments);
  useEffect(() => setDeptList(departments), [departments]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const allDays = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
  const weeks = useMemo(() => buildWeeks(year, month, daysInMonth), [year, month, daysInMonth]);
  const holidayMap = useMemo(() => new Map(holidays.map(h => [h.holidayDate, h.name])), [holidays]);

  const dept = deptList.find(d => d.id === selectedDept);
  const deptName = dept?.name ?? "";

  const filteredPersonnel = useMemo(
    () => personnel.filter(p => personnelInDepartment(p, selectedDept) && p.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [personnel, selectedDept]
  );

  function fmt(d: number) { return fmtDate(year, month, d); }
  function isHoliday(d: number) { return holidayMap.has(fmt(d)); }
  function holidayLabel(d: number) { return holidayMap.get(fmt(d)) ?? ""; }

  // ═════ Veri yükleme ═════
  async function load() {
    setLoading(true);
    const ids = filteredPersonnel.map(p => p.id);
    if (!ids.length) { setEntries([]); setScheds([]); setOverrides([]); setApprovedLeaves([]); setLoading(false); return; }
    try {
      const res = await fetch(`/api/timesheet?year=${year}&month=${month}&dept=${selectedDept}&personnel=${ids.join(",")}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
      setScheds(data.schedules ?? []);
      setOverrides((data.overrides ?? []).map((o: WeeklyOverride & { weekIndex: number }) => ({
        personnelId: o.personnelId, weekIndex: o.weekIndex, worked: o.worked, night: o.night, extra: o.extra, holiday: o.holiday,
      })));
      setApprovedLeaves(data.approvedLeaves ?? []);
    } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedDept) load(); }, [selectedDept, year, month, personnel]);
  useEffect(() => {
    // Aktif haftayı bugünün haftasına getir (mevcut aysa)
    const now = new Date();
    if (now.getFullYear() === year && now.getMonth() === month) {
      const idx = weeks.findIndex(wk => wk.includes(now.getDate()));
      setActiveWeek(idx >= 0 ? idx : 0);
    } else setActiveWeek(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  // ═════ Hesaplamalar ═════
  function getEntry(personId: string, day: number) {
    return entries.find(e => e.personnelId === personId && e.entryDate === fmt(day));
  }
  function getHours(personId: string, day: number): number {
    return getEntry(personId, day)?.hoursWorked || 0;
  }
  function isOnLeaveDay(personId: string, day: number) {
    const date = fmt(day);
    return approvedLeaves.some(l => l.personnelId === personId && date >= l.startDate && date <= l.endDate);
  }
  function weekRequired(wk: number[], type: PersonnelType, personId?: string) {
    const n = wk.filter(d => !isWeeklyRestDay(year, month, d) && !isHoliday(d) && (!personId || !isOnLeaveDay(personId, d))).length;
    return Math.round(n * requiredDailyHours(type) * 100) / 100;
  }
  function weekWorked(personId: string, wk: number[]) {
    return Math.round(wk.reduce((s, d) => s + getHours(personId, d), 0) * 100) / 100;
  }
  function weeklyOverride(personId: string, weekIndex: number) {
    return overrides.find(o => o.personnelId === personId && o.weekIndex === weekIndex);
  }
  // Fazla mesai (hafta sonu ×1.5), Bayram (resmî tatil ×2), Gece (22:00–06:00 net)
  function overtimeFor(person: Personnel, days: number[]) {
    let fmRaw = 0, bmRaw = 0, gm = 0;
    for (const d of days) {
      const hrs = getHours(person.id, d);
      if (isHoliday(d)) bmRaw += hrs;
      else if (isWeekendDay(year, month, d)) fmRaw += hrs;
      const dateStr = fmt(d);
      for (const s of scheds.filter(x => x.personnelId === person.id && x.scheduleDate === dateStr)) {
        if (isNightRange(s.startTime, s.endTime)) {
          gm += getShiftRangeMetrics(s.startTime, s.endTime).worked;
        }
      }
    }
    return {
      fm: Math.round(fmRaw * 1.5 * 100) / 100,
      bm: Math.round(bmRaw * 2 * 100) / 100,
      gm: Math.round(gm * 100) / 100,
    };
  }
  function weekMetric(personId: string, weekIndex: number, wk: number[], field: "worked" | "night" | "extra" | "holiday") {
    const ov = weeklyOverride(personId, weekIndex);
    const v = ov?.[field];
    if (v !== null && v !== undefined) return Number(v) || 0;
    if (field === "worked") return weekWorked(personId, wk);
    const person = filteredPersonnel.find(p => p.id === personId);
    if (!person) return 0;
    return overtimeFor(person, wk)[field === "night" ? "gm" : field === "extra" ? "fm" : "bm"];
  }
  function monthStats(person: Personnel) {
    const required = Math.round(
      allDays.filter(d => !isWeeklyRestDay(year, month, d) && !isHoliday(d) && !isOnLeaveDay(person.id, d)).length
      * requiredDailyHours(person.personnelType) * 100) / 100;
    const worked = Math.round(weeks.reduce((s, wk, i) => s + weekMetric(person.id, i, wk, "worked"), 0) * 100) / 100;
    const workDays = allDays.filter(d => getHours(person.id, d) > 0).length;
    return { required, worked, workDays, diff: Math.round((worked - required) * 100) / 100 };
  }

  function getPuantajCode(personId: string, day: number): string {
    const entry = getEntry(personId, day);
    if (!entry) return "";
    const leave = LEAVE_CODE_MAP[entry.shiftType];
    if (leave) return leave.code;
    if (entry.shiftType !== "MANUAL" && entry.shiftType !== "NOBET") return entry.shiftType;
    if (entry.shiftType === "NOBET") {
      const schedule = scheds.find(s => s.personnelId === personId && s.scheduleDate === fmt(day));
      const slot = schedule ? slotByKey(schedule.shiftSlot) : undefined;
      if (slot) return `${slot.isNight ? "N" : "G"}${grossHours(slot.start, slot.end) >= 12 ? "2" : ""}`;
      // Referans punchCodeForDuty: saat aralığından gündüz/gece kodu üret.
      if (schedule?.startTime && schedule?.endTime) {
        const sh = Number(schedule.startTime.split(":")[0]);
        const eh = Number(schedule.endTime.split(":")[0]);
        const night = eh <= sh || sh >= 18 || sh < 6;
        return `${night ? "N" : "G"}${grossHours(schedule.startTime, schedule.endTime) >= 12 ? "2" : ""}`;
      }
    }
    return entry.hoursWorked ? String(entry.hoursWorked) : "";
  }

  // ═════ Kaydetme ═════
  async function callApi(path: string, method: string, body: unknown) {
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "İşlem başarısız");
    return data;
  }

  async function updatePuantajCode(personId: string, day: number, value: string) {
    const code = normalizeShiftCode(value.replace(",", "."));
    const date = fmt(day);
    const existing = entries.find(e => e.personnelId === personId && e.entryDate === date);
    const metrics = getShiftMetrics(code, isHoliday(day));
    // Kod (G, N2…) veya elle yazılan brüt saat → İş Kanunu m.68 kesintisi uygulanmış net saat
    // (ör. 8 → 7,5 · 9 → 8 · 12 → 11; 7,5 ve altı olduğu gibi kalır)
    const hours = isKnownCode(code) || /^\d+(?:\.\d+)?$/.test(code) ? metrics.worked : 0;
    const shiftType = isKnownCode(code) ? code : "MANUAL";

    if (!code || (hours === 0 && !["İ", "R", "ÜY"].includes(code))) {
      if (existing) {
        await fetch("/api/timesheet", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personnelId: personId, entryDate: date }) });
        setEntries(prev => prev.filter(e => e.id !== existing.id));
      }
      return;
    }
    if (existing) {
      const patch = { shiftType, hoursWorked: hours };
      await callApi("/api/timesheet", "PUT", { personnelId: personId, entryDate: date, ...patch });
      setEntries(prev => prev.map(e => e.id === existing.id ? { ...e, ...patch } : e));
    } else {
      const data = await callApi("/api/timesheet", "PUT", { personnelId: personId, entryDate: date, shiftType, hoursWorked: hours });
      setEntries(prev => [...prev, data.entry]);
    }
  }

  async function saveWeeklyOverride(personId: string, weekIndex: number, field: "worked" | "night" | "extra" | "holiday", value: string) {
    const numeric = value.trim() === "" ? null : Number(value.replace(",", "."));
    if (numeric !== null && !Number.isFinite(numeric)) return;
    const current = weeklyOverride(personId, weekIndex);
    const payload = {
      departmentId: selectedDept, personnelId: personId, periodYear: year, periodMonth: month, weekIndex,
      worked: current?.worked ?? null, night: current?.night ?? null,
      extra: current?.extra ?? null, holiday: current?.holiday ?? null,
      [field]: numeric,
    };
    const data = await callApi("/api/overrides", "PUT", payload);
    const o = data.override;
    setOverrides(prev => [...prev.filter(x => !(x.personnelId === o.personnelId && x.weekIndex === o.weekIndex)), {
      personnelId: o.personnelId, weekIndex: o.weekIndex, worked: o.worked, night: o.night, extra: o.extra, holiday: o.holiday,
    }]);
  }

  async function togglePersonnelType(person: Personnel) {
    const nt = person.personnelType === "ISCI" ? "MEMUR" : "ISCI";
    await callApi("/api/personnel", "PATCH", { id: person.id, personnelType: nt });
    await onPersonnelChanged();
  }

  // ═════ Dışa aktarma (sunucudan gerçek dosya indirimi) ═════
  function exportExcel() {
    // Statik (GitHub Pages) sürümde de çalışması için fetch + blob ile indirilir.
    void downloadFromApi(
      `/api/export/puantaj?dept=${selectedDept}&year=${year}&month=${month}&format=xlsx&group=${staffGroup}`,
      "puantaj.xlsx",
    ).catch(e => alert(e instanceof Error ? e.message : "İndirme başarısız"));
  }

  function exportCSV() {
    void downloadFromApi(
      `/api/export/puantaj?dept=${selectedDept}&year=${year}&month=${month}&format=csv&group=${staffGroup}`,
      "puantaj.csv",
    ).catch(e => alert(e instanceof Error ? e.message : "İndirme başarısız"));
  }

  // ═════ Tablo render ═════
  function renderTableHead(displayWeeks: number[][], showMonthly: boolean) {
    return (
      <thead>
        <tr>
          <th className="p-head p-name">Personel</th>
          {displayWeeks.map(wk => {
            const globalWi = weeks.indexOf(wk);
            return (
              <Fragment key={`grp-${globalWi}`}>
                {wk.map(d => (
                  <th key={`d-${d}`} title={holidayLabel(d)} className="p-head day-col">
                    <div className={`day-head ${isHoliday(d) ? "dh-holiday" : isWeekendDay(year, month, d) ? "dh-weekend" : "dh-workday"}`}>
                      {d}<small>{dayName(year, month, d)}</small>
                    </div>
                  </th>
                ))}
                <th colSpan={6} className="p-head sum first" style={{ textAlign: "center" }}>
                  {globalWi + 1}. Hafta
                </th>
              </Fragment>
            );
          })}
          {showMonthly && <th colSpan={4} className="p-head sum first" style={{ textAlign: "center" }}>Aylık Özet</th>}
        </tr>
        <tr>
          <th className="p-head p-name" />
          {displayWeeks.map((wk, idx) => (
            <Fragment key={`sub-${idx}`}>
              {wk.map(d => (
                <th key={`s-${d}`} className={`p-head day-col ${isHoliday(d) ? "cell-holiday" : isWeekendDay(year, month, d) ? "cell-weekend" : ""}`} />
              ))}
              <th className="p-head sum c-req first">Gerek.</th>
              <th className="p-head sum c-wrk">Çalış.</th>
              <th className="p-head sum">Fark</th>
              <th className="p-head sum c-extra">Fazla</th>
              <th className="p-head sum c-night">Gece</th>
              <th className="p-head sum c-hol">Bayram</th>
            </Fragment>
          ))}
          {showMonthly && (
            <>
              <th className="p-head sum c-req first">Gerek.</th>
              <th className="p-head sum c-wrk">Çalış.</th>
              <th className="p-head sum">Gün</th>
              <th className="p-head sum">Fark</th>
            </>
          )}
        </tr>
      </thead>
    );
  }

  function renderTableBody(displayWeeks: number[][], showMonthly: boolean) {
    if (filteredPersonnel.length === 0) {
      return (
        <tbody><tr><td colSpan={99} className="py-8 text-center text-white/30 text-xs printdoc-empty">
          Bu departmanda personel yok. &quot;Personel Ekle&quot; ile ekleyebilirsiniz.
        </td></tr></tbody>
      );
    }
    return (
      <tbody>
        {filteredPersonnel.map(person => {
          const ms = monthStats(person);
          const tmeta = PERSONNEL_TYPE_META[person.personnelType] ?? PERSONNEL_TYPE_META.MEMUR;
          return (
            <tr key={person.id} className="p-row">
              <td className="p-name">
                <span className="inline-flex items-center gap-1.5">
                  <button
                    onClick={() => togglePersonnelType(person)}
                    title={`${tmeta.label} (${tmeta.weekly}/hf) — tıkla değiştir`}
                    className={`type-chip ${tmeta.chip}`}
                  >{tmeta.short}</button>
                  <span className="truncate">{person.name}</span>
                </span>
              </td>
              {displayWeeks.map(wk => {
                const globalWi = weeks.indexOf(wk);
                const wReq = weekRequired(wk, person.personnelType, person.id);
                const wWrk = weekMetric(person.id, globalWi, wk, "worked");
                const wDiff = Math.round((wWrk - wReq) * 100) / 100;
                const wNight = weekMetric(person.id, globalWi, wk, "night");
                const wExtra = weekMetric(person.id, globalWi, wk, "extra");
                const wHoliday = weekMetric(person.id, globalWi, wk, "holiday");
                return (
                  <Fragment key={`row-${person.id}-w${globalWi}`}>
                    {wk.map(d => {
                      const code = getPuantajCode(person.id, d);
                      const entry = getEntry(person.id, d);
                      const leave = entry ? LEAVE_CODE_MAP[entry.shiftType] : null;
                      const hol = isHoliday(d);
                      const wknd = isWeekendDay(year, month, d);
                      return (
                        <td key={`c-${d}`} className={`p-td day-col ${leave ? "cell-leave" : hol ? "cell-holiday" : wknd ? "cell-weekend" : ""}`}>
                          <ShiftCodeCell
                            value={leave ? leave.code : code}
                            disabled={Boolean(leave)}
                            onCommit={val => updatePuantajCode(person.id, d, val)}
                            title={`${person.name} — ${d} ${dayName(year, month, d)}${holidayLabel(d) ? " · " + holidayLabel(d) : ""}${leave ? " · İzin: " + leave.label : ""}`}
                            className={`day-inp ${leave ? "leave" : hol ? "holiday" : wknd ? "weekend" : ""}`}
                          />
                        </td>
                      );
                    })}
                    <td className="p-td sum c-req first">{wReq}</td>
                    <td className={`p-td sum ${wWrk >= wReq ? "c-wrk" : "c-diff-neg"}`}>
                      <input
                        key={`wo-${person.id}-${globalWi}-${wWrk}`}
                        defaultValue={wWrk || ""}
                        onBlur={e => saveWeeklyOverride(person.id, globalWi, "worked", e.target.value)}
                        className="o-inp" title="Haftalık çalışılan (elle düzeltilebilir)"
                      />
                    </td>
                    <td className={`p-td sum ${wDiff >= 0 ? "c-diff-pos" : "c-diff-neg"}`}>{wDiff > 0 ? `+${wDiff}` : wDiff}</td>
                    <td className="p-td sum c-extra">
                      <input key={`oe-${person.id}-${globalWi}-${wExtra}`} defaultValue={wExtra || ""} onBlur={e => saveWeeklyOverride(person.id, globalWi, "extra", e.target.value)} className="o-inp" title="Fazla mesai (elle düzeltilebilir)" />
                    </td>
                    <td className="p-td sum c-night">
                      <input key={`on-${person.id}-${globalWi}-${wNight}`} defaultValue={wNight || ""} onBlur={e => saveWeeklyOverride(person.id, globalWi, "night", e.target.value)} className="o-inp" title="Gece mesaisi (elle düzeltilebilir)" />
                    </td>
                    <td className="p-td sum c-hol">
                      <input key={`oh-${person.id}-${globalWi}-${wHoliday}`} defaultValue={wHoliday || ""} onBlur={e => saveWeeklyOverride(person.id, globalWi, "holiday", e.target.value)} className="o-inp" title="Bayram mesaisi (elle düzeltilebilir)" />
                    </td>
                  </Fragment>
                );
              })}
              {showMonthly && (
                <>
                  <td className="p-td sum c-req first">{ms.required}</td>
                  <td className={`p-td sum ${ms.worked >= ms.required ? "c-wrk" : "c-diff-neg"}`}>{ms.worked}</td>
                  <td className="p-td sum" style={{ color: "inherit", opacity: .7 }}>{ms.workDays}</td>
                  <td className={`p-td sum ${ms.diff >= 0 ? "c-diff-pos" : "c-diff-neg"}`}>{ms.diff > 0 ? `+${ms.diff}` : ms.diff}</td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    );
  }

  const signatureBlock = (
    <div className="sig-grid print:sig-only">
      {[
        { unvan: dept?.hemsireUnvan ?? "Sorumlu Hemşire", isim: dept?.sorumluHemsire },
        { unvan: dept?.saglikBakimUnvan ?? "Sağlık Bakım Hizmetleri Müdürü", isim: dept?.saglikBakimMuduru },
        { unvan: dept?.bashekimUnvan ?? "Başhekim", isim: dept?.bashekim },
      ].map((s, i) => (
        <div key={i}>
          <div className="sig-line" />
          <div className="who">{s.unvan}</div>
          <div className="title">{s.isim || "………………………………"}</div>
        </div>
      ))}
    </div>
  );

  // ═════ Yazdırma yardımcıları (hafta-blok düzeni) ═════
  function isSat(d: number) { return new Date(year, month, d).getDay() === 6; }
  function isSun(d: number) { return new Date(year, month, d).getDay() === 0; }
  function printDayCls(d: number) { return isHoliday(d) ? "hol" : isSun(d) ? "sun" : isSat(d) ? "sat" : ""; }
  /** Çıktı hücresi: "G (7.5s)" / "N2 (11s)" / izin kodu / düz saat. */
  function printCellText(personId: string, day: number): string {
    const entry = getEntry(personId, day);
    if (!entry) return "";
    const leave = LEAVE_CODE_MAP[entry.shiftType];
    if (leave) return leave.code;
    const code = getPuantajCode(personId, day);
    const hrs = entry.hoursWorked;
    if (code && /^[A-ZİÜÖÇĞŞ]{1,2}2?$/.test(code) && code !== String(hrs)) {
      return hrs ? `${code} (${hrs}s)` : code;
    }
    return hrs ? `${hrs}s` : "";
  }
  function durumText(diff: number): string {
    if (diff > 0) return `+${diff} saat fazla`;
    if (diff < 0) return `${diff} saat eksik`;
    return "tam";
  }

  return (
    <div className="space-y-3">
      {/* Araç çubuğu */}
      <div className="flex flex-wrap items-center gap-2">
        <Btn small variant="primary" onClick={() => setShowAdd(true)}><UserPlus className="w-3.5 h-3.5" /> Personel Ekle</Btn>
        <Btn small onClick={() => setShowManage(true)}><Users className="w-3.5 h-3.5" /> Personel Yönet</Btn>
        <Btn small onClick={() => setShowSig(true)}><FileSignature className="w-3.5 h-3.5" /> İmza Alanları</Btn>
        <div className="flex-1" />
        <Btn small onClick={() => load()} title="Yenile"><RefreshCw className="w-3.5 h-3.5" /></Btn>
        <Btn small variant="success" onClick={exportExcel}><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</Btn>
        <Btn small onClick={exportCSV}><FileText className="w-3.5 h-3.5" /> CSV</Btn>
        <Btn small variant="amber" onClick={() => setShowPrintModal(true)}><Printer className="w-3.5 h-3.5" /> Yazdır / PDF</Btn>
      </div>

      {/* Görünüm anahtarı + hafta sekmeleri */}
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <div className="flex gap-1 bg-white/[.05] border border-white/10 rounded-xl p-1 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("hafta")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${viewMode === "hafta" ? "bg-sky-500/25 text-sky-200" : "text-white/45 hover:text-white"}`}
          >Haftalık</button>
          <button
            type="button"
            onClick={() => setViewMode("ay")}
            title="Tüm haftalar + ay sonu özeti tek tabloda"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${viewMode === "ay" ? "bg-amber-500/25 text-amber-200" : "text-white/45 hover:text-white"}`}
          >Tüm Ay</button>
        </div>
        {viewMode === "hafta" ? (
          <div className="flex gap-2 overflow-x-auto">
            {weeks.map((wk, i) => (
              <button key={i} onClick={() => setActiveWeek(i)} className={`week-tab ${activeWeek === i ? "is-active" : ""}`}>
                <span className="week-tab-idx">{i + 1}</span>
                <span>{i + 1}. Hafta</span>
                <small>{wk[0]}-{wk[wk.length - 1]} {MONTHS[month].slice(0, 3)}</small>
              </button>
            ))}
          </div>
        ) : (
          <span className="text-white/35 text-xs">
            {weeks.length} hafta · {daysInMonth} gün · haftalık özetler ve ay sonu birlikte — yana kaydırarak inceleyin
          </span>
        )}
      </div>

      {/* Ana tablo: haftalık veya tüm ay */}
      <div className={`panel overflow-hidden ${loading ? "opacity-60 pointer-events-none" : ""}`}>
        <div className="overflow-x-auto pui">
          <table>
            {viewMode === "ay"
              ? <>{renderTableHead(weeks, true)}{renderTableBody(weeks, true)}</>
              : <>{renderTableHead([weeks[activeWeek] ?? weeks[0]], false)}{renderTableBody([weeks[activeWeek] ?? weeks[0]], false)}</>}
          </table>
        </div>
      </div>

      {/* Aylık Özet */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" />
          <h2 className="text-white font-semibold text-xs">Aylık Özet</h2>
        </div>
        <div className="overflow-x-auto pui">
          <table>
            <thead>
              <tr>
                <th className="p-head p-name">Personel</th>
                <th className="p-head c-req">Gereken</th>
                <th className="p-head c-wrk">Çalışılan</th>
                <th className="p-head c-night">Gece</th>
                <th className="p-head c-extra">Fazla</th>
                <th className="p-head c-hol">Bayram</th>
                <th className="p-head">Durum</th>
              </tr>
            </thead>
            <tbody>
              {filteredPersonnel.map(person => {
                const ms = monthStats(person);
                const ot = overtimeFor(person, allDays);
                const diff = ms.diff;
                return (
                  <tr key={`m-${person.id}`} className="p-row">
                    <td className="p-td p-name">{person.name}</td>
                    <td className="p-td c-req" style={{ fontWeight: 700 }}>{ms.required}</td>
                    <td className={`p-td ${diff >= 0 ? "c-wrk" : "c-diff-neg"}`} style={{ fontWeight: 700 }}>{ms.worked}</td>
                    <td className="p-td c-night">{ot.gm}</td>
                    <td className="p-td c-extra">{ot.fm}</td>
                    <td className="p-td c-hol">{ot.bm}</td>
                    <td className={`p-td ${diff >= 0 ? "c-diff-pos" : "c-diff-neg"}`} style={{ fontWeight: 800 }}>
                      {diff > 0 ? `+${diff}` : diff} saat
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Haftalık mesai özeti */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-pink-400" />
          <h2 className="text-white font-semibold text-xs">Haftalık Mesai Özeti — Fazla Mesai (×1.5), Gece ve Bayram Mesaisi (×2)</h2>
        </div>
        <div className="overflow-x-auto pui">
          <table>
            <thead>
              <tr>
                <th className="p-head p-name">Personel</th>
                {weeks.map((_, i) => (
                  <th key={`hw-${i}`} colSpan={6} className="p-head sum first" style={{ textAlign: "center" }}>{i + 1}. Hafta</th>
                ))}
                <th colSpan={5} className="p-head sum first" style={{ textAlign: "center" }}>Ay Sonu</th>
              </tr>
              <tr>
                <th className="p-head p-name" />
                {[...weeks.map((_, i) => i), -1].map((k) => (
                  <Fragment key={`sub-${k}`}>
                    <th className="p-head sum c-req first">Gerek.</th>
                    <th className="p-head sum c-wrk">Çalış.</th>
                    <th className="p-head sum">Fark</th>
                    <th className="p-head sum c-extra">Fazla</th>
                    <th className="p-head sum c-night">Gece</th>
                    {k !== -1 && <th className="p-head sum c-hol">Bayram</th>}
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPersonnel.map(person => {
                const ms = monthStats(person);
                const monthOt = overtimeFor(person, allDays);
                return (
                  <tr key={`ot-${person.id}`} className="p-row">
                    <td className="p-td p-name">{person.name}</td>
                    {weeks.map((wk, i) => {
                      const wReq = weekRequired(wk, person.personnelType, person.id);
                      const wWrk = weekMetric(person.id, i, wk, "worked");
                      const wDiff = Math.round((wWrk - wReq) * 100) / 100;
                      const ot = overtimeFor(person, wk);
                      return (
                        <Fragment key={`otw-${i}`}>
                          <td className="p-td sum c-req first">{wReq}</td>
                          <td className="p-td sum c-wrk">{wWrk}</td>
                          <td className={`p-td sum ${wDiff >= 0 ? "c-diff-pos" : "c-diff-neg"}`}>{wDiff > 0 ? `+${wDiff}` : wDiff}</td>
                          <td className="p-td sum c-extra">{ot.fm || ""}</td>
                          <td className="p-td sum c-night">{ot.gm || ""}</td>
                          <td className="p-td sum c-hol">{ot.bm || ""}</td>
                        </Fragment>
                      );
                    })}
                    <td className="p-td sum c-req first">{ms.required}</td>
                    <td className="p-td sum c-wrk">{ms.worked}</td>
                    <td className={`p-td sum ${ms.diff >= 0 ? "c-diff-pos" : "c-diff-neg"}`}>{ms.diff > 0 ? `+${ms.diff}` : ms.diff}</td>
                    <td className="p-td sum c-extra">{monthOt.fm || ""}</td>
                    <td className="p-td sum c-night">{monthOt.gm || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kod açıklamaları */}
      <div className="panel px-4 py-3 flex flex-wrap gap-x-5 gap-y-1.5 items-center text-white/45 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-white/70 font-semibold"><Info className="w-3.5 h-3.5" /> Hücre Kodları:</span>
        <span><b className="text-sky-300">G</b> Gündüz 8s (7,5 net)</span>
        <span><b className="text-sky-300">G2</b> Gündüz 12s (11 net)</span>
        <span><b className="text-violet-300">N / N2</b> Gece 8s / 12s</span>
        <span><b className="text-amber-300">B / B2</b> Bayram 8s / 12s</span>
        <span><b className="text-emerald-300">İ, R, ÜY</b> İzin / Rapor / Ücretsiz</span>
        <span>Ya da brüt saat yazın, ara dinlenme otomatik düşülür: <b className="text-white/70">8 → 7,5 · 9 → 8 · 10 → 9 · 12 → 11</b></span>
      </div>

      {/* İmza bloğu (ekran) */}
      <div className="panel pui px-4 pt-3 pb-6">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-2 flex items-center gap-2">
          <FileSignature className="w-3.5 h-3.5" /> İmzalar
          <button onClick={() => setShowSig(true)} className="text-sky-400 hover:text-sky-300 normal-case font-medium">Düzenle</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl">
          {[
            { unvan: dept?.hemsireUnvan ?? "Sorumlu Hemşire", isim: dept?.sorumluHemsire },
            { unvan: dept?.saglikBakimUnvan ?? "Sağlık Bakım Hizmetleri Müdürü", isim: dept?.saglikBakimMuduru },
            { unvan: dept?.bashekimUnvan ?? "Başhekim", isim: dept?.bashekim },
          ].map((s, i) => (
            <div key={i} className="border-t border-white/15 pt-2 mt-8">
              <div className="text-white/70 text-xs font-semibold">{s.unvan}</div>
              <div className="text-white/40 text-xs">{s.isim || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═════ YAZDIRMA ALANI — hafta blokları + aylık özet (görseldeki form) ═════ */}
      <PrintArea>
        <div className="print-title">
          <h1>{deptName.toLocaleUpperCase("tr")} — {staffGroupMeta(staffGroup).print} — {MONTHS[month]} {year} — PUANTAJ FORMU</h1>
        </div>
        <div className="code-legend">
          <b>Kod açıklamaları:</b> G = Gündüz 8 brüt / 7,5 net · G2 = Gündüz 12 brüt / 11 net · N = Gece 8 brüt / 7,5 net · N2 = Gece 12 brüt / 11 net · B = Bayram 8 brüt / 7,5 net · B2 = Bayram 12 brüt / 11 net · Nöbetler saat aralığına göre G/N kodu ve gerçek net saat olarak gösterilir.
          <br /><b>Net hesap (İş Kanunu m.68 ara dinlenme):</b> 8 saate kadar çalışma → 7,5 saat; 8–12 saat arası çalışmada 1 saat düşülür (9→8 · 10→9 · 11→10 · 12→11); 12 saati aşan nöbette 1,5 saat düşülür. Nöbetler, nöbet tablosundaki saat aralığına göre G/G2 veya N/N2 kodu ve gerçek net saat olarak puantaja aktarılır.
        </div>

        {printOpts.weekly !== false && weeks.map((wk, wi) => (
          <div key={`pw-${wi}`}>
            <div className="pw-h">{wi + 1}. Hafta ({wk[0]}-{wk[wk.length - 1]} {MONTHS[month]})</div>
            <table className="pw">
              <thead>
                <tr>
                  <th className="name">PERSONEL</th>
                  {wk.map(d => (
                    <th key={d} className={printDayCls(d)} title={holidayLabel(d)}>
                      {d}<small>{dayName(year, month, d)}</small>
                    </th>
                  ))}
                  <th className="s-req">Gereken</th>
                  <th className="s-wrk">Çalışılan</th>
                  <th className="s-night">Gece</th>
                  <th className="s-extra">Fazla</th>
                  <th className="s-hol">Bayram</th>
                </tr>
              </thead>
              <tbody>
                {filteredPersonnel.map(p => {
                  const wReq = weekRequired(wk, p.personnelType, p.id);
                  const wWrk = weekMetric(p.id, wi, wk, "worked");
                  const wNight = weekMetric(p.id, wi, wk, "night");
                  const wExtra = weekMetric(p.id, wi, wk, "extra");
                  const wHol = weekMetric(p.id, wi, wk, "holiday");
                  return (
                    <tr key={p.id}>
                      <td className="name">{p.name}</td>
                      {wk.map(d => <td key={d} className={printDayCls(d)}>{printCellText(p.id, d)}</td>)}
                      <td>{wReq}</td><td>{wWrk}</td><td>{wNight || 0}</td><td>{wExtra || 0}</td><td>{wHol || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        {printOpts.monthly !== false && (
          <div>
            <div className="pw-h">AYLIK ÖZET — {MONTHS[month]} {year}</div>
            <table className="pw">
              <thead>
                <tr>
                  <th className="name">PERSONEL</th>
                  <th className="s-req">Gereken</th>
                  <th className="s-wrk">Çalışılan</th>
                  <th className="s-night">Gece Mes.</th>
                  <th className="s-extra">Fazla Mes.</th>
                  <th className="s-hol">Bayram</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredPersonnel.map(p => {
                  const ms = monthStats(p);
                  const ot = overtimeFor(p, allDays);
                  return (
                    <tr key={`ms-${p.id}`}>
                      <td className="name">{p.name}</td>
                      <td>{ms.required}</td><td>{ms.worked}</td>
                      <td>{ot.gm}</td><td>{ot.fm}</td><td>{ot.bm}</td>
                      <td style={{ fontWeight: 700 }}>{durumText(ms.diff)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {printNote.trim() !== "" && (
          <div className="note-block"><b>Dipnot:</b> {printNote}</div>
        )}

        {printOpts.signatures !== false && <div style={{ marginTop: 8 }}>{signatureBlock}</div>}
        <p style={{ marginTop: 8, color: "#6b7280", fontSize: 8 }}>
          Belgelenen saatler nettir (İş Kanunu M.68 mola düşümü uygulanmıştır). Fazla mesai hafta sonu ×1.5, bayram/resmî tatil ×2 olarak özetlenmiştir.
        </p>
      </PrintArea>

      {/* Yazdırma öncesi seçim + dipnot */}
      {showPrintModal && (
        <PrintOptionsModal
          sections={[
            { key: "weekly", label: "Haftalık puantaj tabloları", desc: "Günlük vardiya girişlerini hafta hafta gösterir." },
            { key: "monthly", label: "Aylık özet", desc: "Personel bazlı toplam saatleri gösterir." },
            { key: "signatures", label: "Onay ve imza alanları", desc: "Sorumlu ve yönetici imza bölümlerini ekler." },
          ]}
          storageKey={`p26-print-puantaj-${staffGroup}-${selectedDept}-${year}-${month}`}
          noteHint="Bu not yalnızca seçilen birim ve ayın çıktısında, aylık özet ile imza alanı arasında görünür."
          onConfirm={(values, note) => {
            setPrintOpts(values);
            setPrintNote(note);
            setShowPrintModal(false);
            setTimeout(openPrintPreview, 60);
          }}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Modallar */}
      {showAdd && (
        <AddPersonnelModal
          departments={deptList}
          defaultDeptId={selectedDept}
          defaultGroup={staffGroup}
          onAdded={() => onPersonnelChanged()}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showManage && dept && (
        <PersonnelManageModal
          department={dept}
          personnel={filteredPersonnel}
          onChanged={() => onPersonnelChanged()}
          onClose={() => setShowManage(false)}
        />
      )}
      {showSig && dept && (
        <SignatureModal
          department={dept}
          onSaved={d => { setDeptList(prev => prev.map(x => x.id === d.id ? { ...x, ...d } : x)); onDepartmentUpdated?.(d); }}
          onClose={() => setShowSig(false)}
        />
      )}
    </div>
  );
}
