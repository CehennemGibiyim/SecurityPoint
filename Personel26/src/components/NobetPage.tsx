"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Check, X, Pencil, RefreshCw, Clock, TriangleAlert,
  FileSpreadsheet, FileText, FileSignature, Printer, ArrowUp, ArrowDown, Wand2,
  Save, LayoutTemplate, Users, MonitorDown, Columns3,
} from "lucide-react";
import {
  MONTHS, DAYS_FULL, type Department, type Personnel, type Holiday,
  type ShiftSchedule, type LeaveRequest, type DutyColumn, type ShiftTemplate,
  dayName, isWeekendDay, isWeeklyRestDay, requiredDailyHours, fmtDate,
  personnelInDepartment, isNightRange, formatDutyColumn, normalizeTemplateColumns,
} from "@/lib/shared";
import { staffGroupMeta, defaultServiceName, type StaffGroup } from "@/lib/shared";
import { getShiftRangeMetrics, parseShiftRange } from "@/lib/puantaj-engine";
import { getDutyWarningSummary, warningText, isWarningFor } from "@/lib/roster-conflicts";
import { Btn, Spinner, Modal, Field, TextInput, Badge, cx } from "@/components/ui-kit";
import PrintArea, { openPrintPreview } from "@/components/PrintArea";
import PrintOptionsModal from "@/components/PrintOptionsModal";
import { downloadPanelPreview } from "@/lib/download-preview";
import { downloadFromApi } from "@/lib/download";
import { SignatureModal } from "@/components/modals";

type ApprovedLeave = Pick<LeaveRequest, "personnelId" | "startDate" | "endDate" | "leaveType">;

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "İşlem başarısız");
  return data;
}

function isSaturday(year: number, month: number, day: number) {
  return new Date(year, month, day).getDay() === 6;
}
function isSunday(year: number, month: number, day: number) {
  return new Date(year, month, day).getDay() === 0;
}

export default function NobetPage({
  departments, personnel, holidays, selectedDept, year, month, staffGroup = "SAGLIK", onDepartmentUpdated,
}: {
  departments: Department[]; personnel: Personnel[]; holidays: Holiday[];
  selectedDept: string; year: number; month: number;
  /** Hemşire/Sağlık veya Temizlik/Destek — her grubun ayrı çizelgesi vardır */
  staffGroup?: StaffGroup;
  /** İmza alanları kaydedilince üst bileşendeki servis listesini güncellemek için. */
  onDepartmentUpdated?: (d: Department) => void;
}) {
  const [showSig, setShowSig] = useState(false);
  const [columns, setColumns] = useState<DutyColumn[]>([]);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<ApprovedLeave[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  // Sütun formu
  const [newService, setNewService] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newStart, setNewStart] = useState("08:00");
  const [newEnd, setNewEnd] = useState("20:00");
  const [editingCol, setEditingCol] = useState<DutyColumn | null>(null);
  const [colForm, setColForm] = useState({ service: "", shiftLabel: "", start: "", end: "" });

  // Şablon formu
  const [tplName, setTplName] = useState("");
  const [clearOnApply, setClearOnApply] = useState(true);

  // Yazdırma: bölüm seçimleri + dipnot
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOpts, setPrintOpts] = useState<Record<string, boolean>>({ summary: true, personnelSummary: true, signatures: true });
  const [printNote, setPrintNote] = useState("");

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const allDays = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
  const holidayMap = useMemo(() => new Map(holidays.map(h => [h.holidayDate, h.name])), [holidays]);

  const dept = departments.find(d => d.id === selectedDept);
  const deptName = dept?.name ?? "";
  const deptPersonnel = useMemo(
    () => personnel.filter(p => personnelInDepartment(p, selectedDept) && p.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [personnel, selectedDept]
  );
  const persMap = useMemo(() => new Map(personnel.map(p => [p.id, p])), [personnel]);

  function fmt(d: number) { return fmtDate(year, month, d); }
  function isHoliday(d: number) { return holidayMap.has(fmt(d)); }
  function holidayLabel(d: number) { return holidayMap.get(fmt(d)) ?? ""; }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const pids = personnel.filter(p => personnelInDepartment(p, selectedDept)).map(p => p.id);
      const [roster, tpl] = await Promise.all([
        fetch(`/api/roster?dept=${selectedDept}&year=${year}&month=${month}&group=${staffGroup}&personnel=${pids.join(",")}`).then(r => r.json()),
        fetch("/api/templates").then(r => r.json()).catch(() => ({ templates: [] })),
      ]);
      if (roster.error) throw new Error(roster.error);
      setColumns(roster.columns ?? []);
      setSchedules(roster.schedules ?? []);
      setApprovedLeaves(roster.approvedLeaves ?? []);
      setTemplates(tpl.templates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedDept) { setNewService(defaultServiceName(staffGroup, departments.find(d => d.id === selectedDept)?.name ?? "")); load(); } }, [selectedDept, year, month, personnel, staffGroup]);

  function leaveOn(personnelId: string, date: string) {
    return approvedLeaves.find(l => l.personnelId === personnelId && date >= l.startDate && date <= l.endDate);
  }
  function personName(id: string) {
    return persMap.get(id)?.name ?? "?";
  }
  function recordFor(day: number, col: DutyColumn) {
    return schedules.find(s => s.scheduleDate === fmt(day) && String(s.columnKey ?? "") === col.key);
  }

  // ═════ Hücre atama ═════
  async function setCell(day: number, col: DutyColumn, personnelId: string) {
    const current = recordFor(day, col);
    if ((current?.personnelId ?? "") === personnelId) return;
    setError(""); setMsg("");
    try {
      const data = await api("/api/roster/cell", "PUT", {
        departmentId: selectedDept, date: fmt(day), columnKey: col.key, personnelId: personnelId || null,
      });
      setSchedules(prev => {
        const rest = prev.filter(s => !(s.scheduleDate === fmt(day) && String(s.columnKey ?? "") === col.key));
        return data.schedule ? [...rest, data.schedule] : rest;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi");
      load();
    }
  }

  // ═════ Sütun işlemleri ═════
  async function addColumn() {
    if (!newService.trim()) return;
    setError("");
    try {
      const data = await api("/api/roster/columns", "POST", {
        departmentId: selectedDept, year, month, staffGroup,
        service: newService, shiftLabel: newLabel || undefined,
        startTime: newStart, endTime: newEnd,
      });
      setColumns(prev => [...prev, data.column]);
      setNewLabel("");
      setMsg(`Sütun eklendi: ${formatDutyColumn(data.column)}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Eklenemedi"); }
  }
  function startEditColumn(col: DutyColumn) {
    setEditingCol(col);
    setColForm({ service: col.service, shiftLabel: col.shiftLabel, start: col.startTime, end: col.endTime });
  }
  async function saveEditColumn() {
    if (!editingCol) return;
    try {
      const data = await api("/api/roster/columns", "PATCH", {
        id: editingCol.id, service: colForm.service, shiftLabel: colForm.shiftLabel,
        startTime: colForm.start, endTime: colForm.end,
      });
      setColumns(prev => prev.map(c => c.id === editingCol.id ? data.column : c));
      setEditingCol(null);
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "Güncellenemedi"); }
  }
  async function moveColumnReq(id: string, direction: "up" | "down") {
    const data = await api("/api/roster/columns", "POST", { action: "move", id, direction });
    setColumns(data.columns);
  }
  async function removeColumnReq(col: DutyColumn) {
    const linked = schedules.filter(s => String(s.columnKey ?? "") === col.key).length;
    if (!confirm(`"${formatDutyColumn(col)}" sütunu silinsin mi?${linked ? ` Bu sütundaki ${linked} atama da silinecek!` : ""}`)) return;
    await api("/api/roster/columns", "DELETE", { id: col.id });
    setColumns(prev => prev.filter(c => c.id !== col.id));
    load();
  }

  // ═════ Şablon işlemleri ═════
  const visibleTemplates = templates.filter(t => !t.departmentId || t.departmentId === selectedDept);
  async function saveTemplate() {
    if (!tplName.trim() || !columns.length) return;
    setError(""); setMsg("");
    try {
      await api("/api/templates", "POST", {
        name: tplName.trim(), departmentId: null,
        slots: columns.map(c => ({ service: c.service, shiftLabel: c.shiftLabel, startTime: c.startTime, endTime: c.endTime })),
      });
      setTplName("");
      setMsg("Şablon kaydedildi.");
      const tpl = await fetch("/api/templates").then(r => r.json());
      setTemplates(tpl.templates ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Kaydedilemedi"); }
  }
  async function applyTemplate(t: ShiftTemplate) {
    const cols = normalizeTemplateColumns(t.slots);
    if (!cols.length) return;
    if (schedules.length && clearOnApply) {
      if (!confirm(`"${t.name}" uygulanacak ve ${MONTHS[month]} ${year} ayındaki ${schedules.length} atama silinecek. Diğer aylar korunur. Devam?`)) return;
    }
    setBusy(true); setError(""); setMsg("");
    try {
      await api("/api/templates/apply", "POST", { templateId: t.id, departmentId: selectedDept, clearAssignments: clearOnApply, year, month, staffGroup });
      setMsg(`"${t.name}" uygulandı (${cols.length} sütun).`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Uygulanamadı"); }
    finally { setBusy(false); }
  }
  async function deleteTemplate(t: ShiftTemplate) {
    if (!confirm(`"${t.name}" şablonu silinsin mi?`)) return;
    await api("/api/templates", "DELETE", { id: t.id });
    setTemplates(prev => prev.filter(x => x.id !== t.id));
  }
  /** Şablonu tek adımda işle: sütunları kur + seçili ayı taslakla doldur. */
  async function processTemplate(t: ShiftTemplate) {
    const cols = normalizeTemplateColumns(t.slots);
    if (!cols.length) return;
    if (!confirm(`"${t.name}" şablonu ${deptName} servisinde ${MONTHS[month]} ${year} ayına işlenecek:\n• ${cols.length} sütun kurulacak\n• Ay dengeli taslakla doldurulacak\n• Mevcut ${schedules.length} atama silinecek\n\nDevam?`)) return;
    setBusy(true); setError(""); setMsg("");
    try {
      const res = await api("/api/templates/process", "POST", {
        templateId: t.id, departmentId: selectedDept, year, month, staffGroup,
      });
      setMsg(`"${res.template}" işlendi: ${res.columns} sütun kuruldu, ${res.placed} atama yerleştirildi${res.skipped ? ` (${res.skipped} hücre boş bırakıldı)` : ""}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "İşlenemedi"); }
    finally { setBusy(false); }
  }
  /** Şablonun içeriğini mevcut sütun düzeniyle güncelle. */
  async function updateTemplateFromColumns(t: ShiftTemplate) {
    if (!columns.length) { setError("Güncellemek için önce sütun tanımlayın."); return; }
    if (!confirm(`"${t.name}" şablonunun içeriği mevcut ${columns.length} sütunla değiştirilsin mi?`)) return;
    setError(""); setMsg("");
    try {
      await api("/api/templates", "PATCH", {
        id: t.id,
        slots: columns.map(c => ({ service: c.service, shiftLabel: c.shiftLabel, startTime: c.startTime, endTime: c.endTime })),
      });
      setMsg(`"${t.name}" mevcut sütunlarla güncellendi.`);
      const tpl = await fetch("/api/templates").then(r => r.json());
      setTemplates(tpl.templates ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Güncellenemedi"); }
  }

  // ═════ Taslak ═════
  /**
   * Nöbet çizelgesini Excel/CSV olarak indirir.
   * fetch + blob akışı sayesinde hem sunuculu hem de GitHub Pages
   * (tarayıcı veritabanı) sürümünde aynı şekilde çalışır.
   */
  function exportRoster(format: "xlsx" | "csv") {
    const url = `/api/export/nobet?dept=${selectedDept}&year=${year}&month=${month}&format=${format}&group=${staffGroup}`;
    void downloadFromApi(url, `nobet_cizelgesi.${format}`)
      .catch(e => setError(e instanceof Error ? e.message : "İndirme başarısız"));
  }

  async function runDraft() {
    if (!columns.length) { setError("Önce nöbet sütunu tanımlayın."); return; }
    const overwrite = schedules.length > 0;
    if (overwrite && !confirm(`Mevcut ${schedules.length} atama silinip dengeli taslak oluşturulacak. Devam?`)) return;
    setBusy(true); setError(""); setMsg("");
    try {
      const res = await api("/api/roster/draft", "POST", { departmentId: selectedDept, year, month, overwrite, staffGroup });
      setMsg(`${res.placed} atama yerleştirildi${res.skipped ? `, ${res.skipped} hücre izin/kadro nedeniyle boş bırakıldı` : ""}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Taslak oluşturulamadı"); }
    finally { setBusy(false); }
  }

  // ═════ Özetler ═════
  const totals = useMemo(() => {
    let count = 0, gross = 0, net = 0, night = 0, extra = 0, holiday = 0;
    schedules.forEach(s => {
      count++;
      const m = getShiftRangeMetrics(s.startTime, s.endTime);
      gross += m.gross; net += m.worked;
      if (isNightRange(s.startTime, s.endTime)) night += m.worked;
      extra += m.extra;
      const day = parseInt(s.scheduleDate.slice(-2));
      if (holidayMap.has(fmt(day))) holiday += m.worked;
    });
    const r = (n: number) => Math.round(n * 100) / 100;
    return { count, gross: r(gross), net: r(net), night: r(night), extra: r(extra), holiday: r(holiday) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, holidayMap]);

  const warningSummary = useMemo(() => getDutyWarningSummary(schedules), [schedules]);

  function calcStats(person: Personnel) {
    const required = Math.round(allDays.filter(d => !isWeeklyRestDay(year, month, d) && !isHoliday(d)).length * requiredDailyHours(person.personnelType) * 100) / 100;
    let worked = 0, nightHours = 0, extraHours = 0, holidayHours = 0, workDays = 0;
    schedules.filter(s => s.personnelId === person.id).forEach(s => {
      const hrs = getShiftRangeMetrics(s.startTime, s.endTime).worked;
      if (hrs <= 0) return;
      const day = parseInt(s.scheduleDate.slice(-2));
      if (isNightRange(s.startTime, s.endTime)) nightHours += hrs;
      worked += hrs;
      if (isHoliday(day)) holidayHours += hrs;
      if (isWeekendDay(year, month, day) || isHoliday(day)) extraHours += hrs;
      workDays++;
    });
    const r = (n: number) => Math.round(n * 100) / 100;
    return { required, worked: r(worked), nightHours: r(nightHours), extraHours: r(extraHours), holidayHours: r(holidayHours), workDays, diff: r(worked - required) };
  }

  function serviceSummary() {
    const groups: { service: string; shifts: string[] }[] = [];
    columns.forEach(c => {
      let g = groups.find(x => x.service === c.service);
      if (!g) { g = { service: c.service, shifts: [] }; groups.push(g); }
      if (!g.shifts.includes(c.shiftLabel)) g.shifts.push(c.shiftLabel);
    });
    return groups;
  }

  /** Sütun / şablon paneline kaydırıp kısa süre vurgular. */
  function jumpTo(which: "cols" | "tpl") {
    const el = document.getElementById(which === "cols" ? "duty-columns-panel" : "duty-templates-panel");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("panel-flash");
    setTimeout(() => el.classList.remove("panel-flash"), 1600);
  }

  return (
    <div className="space-y-3">
      {/* Başlık + araçlar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-white font-bold text-sm" style={{ fontFamily: "var(--font-grotesk)" }}>
          <Clock className="w-4 h-4 text-sky-400" /> Nöbet Çizelgesi
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${staffGroupMeta(staffGroup).badge}`}>{staffGroupMeta(staffGroup).label}</span>
        <span className="text-white/35 text-xs">{deptName} · {MONTHS[month]} {year}</span>
        <div className="flex-1" />
        <Btn small onClick={() => jumpTo("cols")} title="Nöbet sütunlarını yönet (ekle / düzenle / sırala / sil)">
          <Columns3 className="w-3.5 h-3.5" /> Sütunlar ({columns.length})
        </Btn>
        <Btn small onClick={() => jumpTo("tpl")} title="Vardiya şablonlarını yönet ve uygula">
          <LayoutTemplate className="w-3.5 h-3.5" /> Şablonlar
        </Btn>
        <Btn small onClick={() => load()} title="Yenile"><RefreshCw className="w-3.5 h-3.5" /></Btn>
        <Btn small variant="primary" onClick={runDraft} disabled={busy}><Wand2 className="w-3.5 h-3.5" /> Taslak Oluştur</Btn>
        <Btn small variant="success" onClick={() => exportRoster("xlsx")}><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</Btn>
        <Btn small onClick={() => exportRoster("csv")}><FileText className="w-3.5 h-3.5" /> CSV</Btn>
        <Btn small onClick={() => setShowSig(true)}><FileSignature className="w-3.5 h-3.5" /> İmza Alanları</Btn>
        <Btn small variant="amber" onClick={() => setShowPrintModal(true)}><Printer className="w-3.5 h-3.5" /> Yazdır / PDF</Btn>
        <Btn small onClick={() => downloadPanelPreview()} title="Bu ekranın statik kopyasını index.html olarak indir (paylaşım için)"><MonitorDown className="w-3.5 h-3.5" /> Arayüzü İndir (.html)</Btn>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/40 text-rose-200 text-xs rounded-xl px-4 py-2.5 anim-slide">
          <TriangleAlert className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError("")} className="ml-auto text-rose-300/60 hover:text-rose-200"><X className="w-4 h-4" /></button>
        </div>
      )}
      {msg && !error && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 text-xs rounded-xl px-4 py-2.5 anim-slide">
          <Check className="w-4 h-4 shrink-0" /> {msg}
          <button onClick={() => setMsg("")} className="ml-auto text-emerald-300/60 hover:text-emerald-200"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Özet kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          ["Atama", String(totals.count), "text-white"],
          ["Brüt Saat", String(totals.gross), "text-sky-300"],
          ["Net Saat", String(totals.net), "text-emerald-300"],
          ["Gece", String(totals.night), "text-violet-300"],
          ["Fazla (7,5 üstü)", String(totals.extra), "text-pink-300"],
        ].map(([label, val, cls]) => (
          <div key={label} className="panel !rounded-xl px-3 py-2 text-center">
            <div className={cx("text-base font-black", cls)} style={{ fontFamily: "var(--font-grotesk)" }}>{val}</div>
            <div className="text-white/35 text-[10px] uppercase tracking-wider font-bold">{label}</div>
          </div>
        ))}
      </div>

      {/* Çakışma uyarıları */}
      {warningSummary.length > 0 && (
        <div className="panel !border-amber-500/40 overflow-hidden anim-slide">
          <div className="px-4 py-2.5 border-b border-amber-500/25 flex items-center gap-2 bg-amber-500/[.06]">
            <TriangleAlert className="w-4 h-4 text-amber-400" />
            <span className="text-amber-200 font-bold text-xs">Çakışma Uyarıları</span>
            <span className="text-amber-300/70 text-xs">({warningSummary.length}) — aynı gün çift atama ve 11 saat altı dinlenme</span>
          </div>
          <ul className="px-4 py-2 space-y-1 max-h-40 overflow-y-auto">
            {warningSummary.slice(0, 12).map(w => (
              <li key={w.key} className="text-xs text-white/65 flex items-center gap-2">
                <span className={cx("w-1.5 h-1.5 rounded-full shrink-0", w.warning.type === "overlap" ? "bg-rose-400" : "bg-amber-400")} />
                {warningText(w, personName(w.personnelId), year, month)}
              </li>
            ))}
            {warningSummary.length > 12 && (
              <li className="text-[11px] text-white/35">… ve {warningSummary.length - 12} uyarı daha</li>
            )}
          </ul>
        </div>
      )}

      {/* ═════ ÇİZELGE IZGARASI ═════ */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <h2 className="text-white font-semibold text-xs">Aylık Çizelge</h2>
          <span className="text-white/35 text-[11px]">Hücreye tıklayıp personeli seçin — boş bırakmak için “—” seçin</span>
          <div className="flex-1" />
          <span className="text-white/40 text-xs font-bold bg-white/[.06] rounded-lg px-2 py-1">{schedules.length} atama</span>
        </div>
        {columns.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-white font-bold text-xs mb-1">Henüz nöbet sütunu yok</div>
            <p className="text-white/40 text-xs max-w-md mx-auto mb-3">Çizelgenin oluşması için önce “Hizmet (Saat)” sütunlarını tanımlayın ya da kayıtlı bir şablonu uygulayın.</p>
            <div className="flex justify-center gap-2">
              <Btn small variant="primary" onClick={() => jumpTo("cols")}><Plus className="w-3.5 h-3.5" /> Sütun Ekle</Btn>
              <Btn small onClick={() => jumpTo("tpl")}><LayoutTemplate className="w-3.5 h-3.5" /> Şablon Uygula</Btn>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto roster-wrap">
            <table className="roster-table">
              <thead>
                <tr>
                  <th className="roster-th roster-date">Tarih</th>
                  <th className="roster-th roster-day">Gün</th>
                  {columns.map(c => (
                    <th key={c.id} className="roster-th" title={`${c.startTime}–${c.endTime}`}>
                      <div className="font-bold text-white/80">{c.service}</div>
                      <div className="font-semibold text-sky-300/90">{c.shiftLabel}</div>
                      <div className="text-[9px] font-medium opacity-60">{c.startTime}–{c.endTime}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allDays.map(d => {
                  const hol = isHoliday(d);
                  const sat = isSaturday(year, month, d);
                  const sun = isSunday(year, month, d);
                  return (
                    <tr key={d} className={cx("roster-row", hol && "is-holiday", !hol && sat && "is-saturday", !hol && sun && "is-sunday")}>
                      <td className="roster-td roster-date" title={holidayLabel(d)}>
                        {d}.{String(month + 1).padStart(2, "0")}
                      </td>
                      <td className="roster-td roster-day" title={holidayLabel(d)}>
                        {dayName(year, month, d)}
                        {hol && <span className="block text-[8.5px] font-semibold opacity-75 truncate max-w-[90px]">{holidayLabel(d)}</span>}
                      </td>
                      {columns.map(col => {
                        const rec = recordFor(d, col);
                        const warn = rec ? isWarningFor(rec, schedules) : false;
                        return (
                          <td key={col.id} className="roster-td">
                            <select
                              value={rec?.personnelId ?? ""}
                              onChange={e => setCell(d, col, e.target.value)}
                              disabled={busy}
                              title={rec ? `${personName(rec.personnelId)} · ${col.startTime}–${col.endTime} · net ${getShiftRangeMetrics(rec.startTime, rec.endTime).worked}s${warn ? " · ⚠ çakışma/dinlenme uyarısı" : ""}` : `${d} ${formatDutyColumn(col)}`}
                              className={cx("roster-select", warn && "has-warning", rec && "is-filled")}
                            >
                              <option value="">—</option>
                              {deptPersonnel.map(p => {
                                const onLeave = Boolean(leaveOn(p.id, fmt(d)));
                                return (
                                  <option key={p.id} value={p.id} disabled={onLeave}>
                                    {p.name}{onLeave ? " (izinli)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {/* ═════ SÜTUN YÖNETİMİ ═════ */}
        <div id="duty-columns-panel" className="panel p-4 space-y-3 scroll-mt-24">
          <div>
            <h2 className="text-white font-semibold text-xs flex items-center gap-2"><Columns3 className="w-4 h-4 text-sky-400" /> Nöbet Sütunları</h2>
            <p className="text-white/35 text-[11px]">Izgaradaki “Hizmet (Saat)” sütunlarını buradan tanımlayın.</p>
          </div>
          <div className="grid grid-cols-[1fr_1fr] gap-2">
            <Field label="Hizmet">
              <TextInput value={newService} onChange={e => setNewService(e.target.value)} placeholder="Genel Servis" />
            </Field>
            <Field label="Saat Etiketi (opsiyonel)">
              <TextInput value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="08:00–20:00" />
            </Field>
            <Field label="Başlangıç">
              <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)}
                className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70" />
            </Field>
            <Field label="Bitiş">
              <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70" />
            </Field>
          </div>
          <Btn small variant="primary" onClick={addColumn} disabled={!newService.trim()}><Plus className="w-3.5 h-3.5" /> Sütun Ekle</Btn>

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {columns.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 bg-white/[.04] border border-white/10 rounded-xl px-3 py-2">
                <span className="text-white/30 text-[10px] font-bold w-5 shrink-0">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-bold truncate">{c.service}</div>
                  <div className="text-sky-300/80 text-[11px]">{c.shiftLabel} · {c.startTime}–{c.endTime}</div>
                </div>
                <button onClick={() => startEditColumn(c)} className="p-1.5 text-white/40 hover:text-sky-300 transition" title="Düzenle"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveColumnReq(c.id, "up")} disabled={i === 0} className="p-1.5 text-white/40 hover:text-white transition disabled:opacity-25" title="Yukarı"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveColumnReq(c.id, "down")} disabled={i === columns.length - 1} className="p-1.5 text-white/40 hover:text-white transition disabled:opacity-25" title="Aşağı"><ArrowDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => removeColumnReq(c)} className="p-1.5 text-white/40 hover:text-rose-300 transition" title="Sütunu sil"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {columns.length === 0 && <p className="text-white/30 text-xs text-center py-4">Sütun yok — yukarıdan ekleyin.</p>}
          </div>
        </div>

        {/* ═════ ŞABLONLAR ═════ */}
        <div id="duty-templates-panel" className="panel p-4 space-y-3 scroll-mt-24">
          <div>
            <h2 className="text-white font-semibold text-xs flex items-center gap-2"><LayoutTemplate className="w-4 h-4 text-violet-400" /> Vardiya Şablonları</h2>
            <p className="text-white/35 text-[11px]">Mevcut sütun düzenini kaydedin; <b className="text-white/60">Sütunları Kur</b> yalnızca düzeni kurar, <b className="text-white/60">İşle</b> düzeni kurup {MONTHS[month]} {year} ayını taslakla doldurur.</p>
          </div>
          <div className="flex gap-2">
            <TextInput value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Şablon adı, örn. Standart Servis Düzeni" onKeyDown={e => e.key === "Enter" && saveTemplate()} />
            <Btn small variant="primary" onClick={saveTemplate} disabled={!tplName.trim() || !columns.length}><Save className="w-3.5 h-3.5" /> Kaydet</Btn>
          </div>
          <label className="flex items-center gap-2 text-white/55 text-xs cursor-pointer">
            <input type="checkbox" checked={clearOnApply} onChange={e => setClearOnApply(e.target.checked)} className="accent-sky-400" />
            Uygularken bu ayın atamalarını temizle (diğer aylar korunur)
          </label>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {visibleTemplates.map(t => {
              const cols = normalizeTemplateColumns(t.slots);
              return (
                <div key={t.id} className="bg-white/[.04] border border-white/10 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-bold truncate">{t.name}</div>
                      <div className="text-white/35 text-[10px]">{cols.length} sütun{t.departmentId ? "" : " · tüm servisler"}</div>
                    </div>
                    <Btn small variant="amber" onClick={() => applyTemplate(t)} disabled={busy} title="Yalnızca sütun düzenini kur">Sütunları Kur</Btn>
                    <Btn small variant="primary" onClick={() => processTemplate(t)} disabled={busy} title={`${MONTHS[month]} ${year} ayını bu şablonla doldur`}>
                      <Wand2 className="w-3.5 h-3.5" /> İşle
                    </Btn>
                    <button onClick={() => updateTemplateFromColumns(t)} className="p-1.5 text-white/40 hover:text-sky-300 transition" title="Şablonu mevcut sütunlarla güncelle"><Save className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteTemplate(t)} className="p-1.5 text-white/40 hover:text-rose-300 transition" title="Şablonu sil"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="text-white/40 text-[10px] mt-1 truncate">{cols.map(c => formatDutyColumn(c)).join(" · ")}</div>
                </div>
              );
            })}
            {visibleTemplates.length === 0 && <p className="text-white/30 text-xs text-center py-4">Kayıtlı şablon yok — yukarıdan mevcut düzeni kaydedin.</p>}
          </div>
        </div>
      </div>

      {/* Personel ay özeti */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 text-white font-semibold text-xs flex items-center gap-2">
          <Users className="w-4 h-4 text-sky-400" /> Personel Aylık Özet — {deptName}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/45 text-[11px] uppercase tracking-wider">
                <th className="text-left px-4 py-2">Personel</th>
                <th className="text-center px-2 py-2 text-sky-300">Gereken</th>
                <th className="text-center px-2 py-2 text-emerald-300">Çalışılan</th>
                <th className="text-center px-2 py-2 text-violet-300">Gece</th>
                <th className="text-center px-2 py-2 text-amber-300">Hz.Sonu/Tatil</th>
                <th className="text-center px-2 py-2">Gün</th>
                <th className="text-center px-2 py-2">Fark</th>
              </tr>
            </thead>
            <tbody>
              {deptPersonnel.map(p => {
                const st = calcStats(p);
                return (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[.03] transition">
                    <td className="px-4 py-1.5 text-white font-medium">{p.name}</td>
                    <td className="text-center text-sky-300">{st.required}</td>
                    <td className="text-center text-emerald-300 font-bold">{st.worked}</td>
                    <td className="text-center text-violet-300">{st.nightHours}</td>
                    <td className="text-center text-amber-300">{st.extraHours}</td>
                    <td className="text-center text-white/50">{st.workDays}</td>
                    <td className={cx("text-center font-bold", st.diff >= 0 ? "text-emerald-400" : "text-rose-400")}>{st.diff > 0 ? `+${st.diff}` : st.diff}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sütun düzenleme modali */}
      {editingCol && (
        <Modal title={<><Pencil className="w-4 h-4 text-sky-400" /> Sütunu Düzenle</>} onClose={() => setEditingCol(null)}>
          <div className="space-y-3">
            <Field label="Hizmet">
              <TextInput value={colForm.service} onChange={e => setColForm(p => ({ ...p, service: e.target.value }))} />
            </Field>
            <Field label="Saat Etiketi">
              <TextInput value={colForm.shiftLabel} onChange={e => setColForm(p => ({ ...p, shiftLabel: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Başlangıç">
                <input type="time" value={colForm.start} onChange={e => setColForm(p => ({ ...p, start: e.target.value }))}
                  className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70" />
              </Field>
              <Field label="Bitiş">
                <input type="time" value={colForm.end} onChange={e => setColForm(p => ({ ...p, end: e.target.value }))}
                  className="w-full bg-white/[.07] border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-sky-400/70" />
              </Field>
            </div>
            <p className="text-white/35 text-[11px]">Saat değişikliği bu sütundaki tüm atamaların puantajına yansır.</p>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setEditingCol(null)}>İptal</Btn>
              <Btn variant="primary" onClick={saveEditColumn}><Check className="w-4 h-4" /> Kaydet</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Yazdırma */}
      <PrintArea>
        <div className="print-title">
          <h1>{MONTHS[month].toLocaleUpperCase("tr")} {year} {staffGroupMeta(staffGroup).print} NÖBET LİSTESİ</h1>
          <p>{deptName} · Nöbet planı ve günlük personel dağılımı</p>
        </div>

        {printOpts.summary !== false && (
          <div className="info-grid">
            <div className="info-box" style={{ flex: 1 }}>
              <b>SERVİSLER / HİZMET ALANLARI:</b>
              {serviceSummary().map(g => (
                <div key={g.service}><b>{g.service.toLocaleUpperCase("tr")}:</b> {g.shifts.join(" | ")}</div>
              ))}
              {deptPersonnel[0] && (
                <div style={{ marginTop: 4 }}>
                  <b>TOPLAM SAAT / HEDEFLENEN:</b> {calcStats(deptPersonnel[0]).required} SAAT
                </div>
              )}
            </div>
            <div className="info-box">
              <b>TOPLAM SAATLER</b>
              <div>Personel: {deptPersonnel.length}</div>
              <div>Brüt saat: {totals.gross}</div>
              <div>Net saat: {totals.net}</div>
              <div>Gece saati: {totals.night}</div>
              <div>Fazla mesai: {totals.extra}</div>
              <div>Bayram saati: {totals.holiday}</div>
            </div>
          </div>
        )}

        <table className="pw">
          <thead>
            <tr>
              <th style={{ width: 64 }}>TARİH</th>
              <th style={{ width: 70 }}>GÜNLER</th>
              {columns.map(c => <th key={c.id}>{formatDutyColumn(c).toLocaleUpperCase("tr")}</th>)}
            </tr>
          </thead>
          <tbody>
            {allDays.map(d => {
              const cls = isHoliday(d) ? "hol" : isSunday(year, month, d) ? "sun" : isSaturday(year, month, d) ? "sat" : "";
              return (
                <tr key={d}>
                  <td className={cls} style={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                    {String(d).padStart(2, "0")}.{String(month + 1).padStart(2, "0")}.{year}
                  </td>
                  <td className={cls}>{DAYS_FULL[new Date(year, month, d).getDay()]}{holidayLabel(d) ? ` (${holidayLabel(d)})` : ""}</td>
                  {columns.map(c => {
                    const rec = recordFor(d, c);
                    return <td key={c.id} className={cls} style={{ fontWeight: rec ? 700 : 400 }}>{rec ? personName(rec.personnelId) : ""}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {printOpts.personnelSummary !== false && (
          <>
            <div className="pw-h">PERSONEL AYLIK ÖZETİ</div>
            <table className="pw" style={{ width: "70%" }}>
              <thead>
                <tr>
                  <th className="name">PERSONEL</th>
                  <th className="s-req">Gereken</th>
                  <th className="s-wrk">Çalışılan</th>
                  <th className="s-night">Gece</th>
                  <th className="s-extra">Hz.Sonu/Tatil</th>
                  <th>Fark</th>
                </tr>
              </thead>
              <tbody>
                {deptPersonnel.map(p => {
                  const st = calcStats(p);
                  return (
                    <tr key={p.id}>
                      <td className="name">{p.name}</td>
                      <td>{st.required}</td><td>{st.worked}</td>
                      <td>{st.nightHours}</td><td>{st.extraHours}</td>
                      <td style={{ fontWeight: 700 }}>{st.diff > 0 ? `+${st.diff}` : st.diff}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {printNote.trim() !== "" && (
          <div className="note-block"><b>Dipnot:</b> {printNote}</div>
        )}

        {printOpts.signatures !== false && (
          <>
            <div className="onay-h">ONAY MAKAM LİSTESİ</div>
            <div className="sig-grid">
              {[
                { unvan: dept?.hemsireUnvan ?? "Sorumlu Hemşire", isim: dept?.sorumluHemsire },
                { unvan: dept?.saglikBakimUnvan ?? "Sağlık Bakım Hizmetleri Müdürü", isim: dept?.saglikBakimMuduru },
                { unvan: dept?.bashekimUnvan ?? "Başhekim", isim: dept?.bashekim },
              ].map((s, i) => (
                <div key={i}>
                  <div className="sig-line" />
                  <div className="who">{s.unvan.toLocaleUpperCase("tr")}</div>
                  <div className="title">{s.isim || "………………………………"}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </PrintArea>

      {showSig && dept && (
        <SignatureModal
          department={dept}
          onSaved={d => onDepartmentUpdated?.(d)}
          onClose={() => setShowSig(false)}
        />
      )}

      {/* Yazdırma öncesi seçim + dipnot */}
      {showPrintModal && (
        <PrintOptionsModal
          sections={[
            { key: "summary", label: "Servis ve toplam saat kutuları", desc: "Hizmet alanları ile brüt/net/gece toplamlarını üstte gösterir." },
            { key: "personnelSummary", label: "Personel aylık özeti", desc: "Kişi bazlı gereken/çalışılan/fark tablosunu ekler." },
            { key: "signatures", label: "Onay ve imza alanları", desc: "Onay makam listesi ile imza bölümlerini ekler." },
          ]}
          storageKey={`p26-print-nobet-${staffGroup}-${selectedDept}-${year}-${month}`}
          noteHint="Bu not yalnızca seçilen birim ve ayın nöbet çıktısında, tablo ile imza alanı arasında görünür."
          onConfirm={(values, note) => {
            setPrintOpts(values);
            setPrintNote(note);
            setShowPrintModal(false);
            setTimeout(openPrintPreview, 60);
          }}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
