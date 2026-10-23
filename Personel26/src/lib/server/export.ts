import { db } from "@/db";
import {
  departments, personnel, personnelDepartments, holidays,
  timesheetEntries, shiftSchedules, weeklyOverrides, leaveRequests,
} from "@/db/schema";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import {
  MONTHS, DAYS_FULL, dayName, isWeekendDay, isWeeklyRestDay, buildWeeks,
  requiredDailyHours, fmtDate, isNightRange, LEAVE_CODE_MAP, APPROVAL_FLOW, fmtTr,
  personnelTypeLabel, staffGroupMeta, type StaffGroup,
} from "@/lib/shared";
import { getShiftRangeMetrics } from "@/lib/puantaj-engine";
import * as XLSX from "xlsx";

export function safeFileName(...parts: (string | number)[]) {
  return parts.join("_").replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/_+/g, "_");
}

// ══════════════════════════════════
// Ortak veri yükleme
// ══════════════════════════════════
async function loadBase(deptId: string, year: number, month: number, group?: StaffGroup) {
  const dept = (await db.select().from(departments).where(eq(departments.id, deptId)))[0];
  const assignments = await db.select().from(personnelDepartments).where(eq(personnelDepartments.departmentId, deptId));
  const ids = assignments.map(a => a.personnelId);
  const people = ids.length
    ? await db.select().from(personnel).where(and(inArray(personnel.id, ids), eq(personnel.isActive, true)))
    : [];
  // Personel grubu verildiyse (Hemşire/Sağlık · Temizlik/Destek) yalnızca o grup
  const filtered = group ? people.filter(p => (p.staffGroup ?? "SAGLIK") === group) : people;
  filtered.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const hols = await db.select().from(holidays);
  return { dept, people: filtered, hols, ids: group ? filtered.map(p => p.id) : ids };
}

function monthRange(year: number, month: number) {
  const dim = new Date(year, month + 1, 0).getDate();
  return {
    dim,
    startD: `${year}-${String(month + 1).padStart(2, "0")}-01`,
    endD: `${year}-${String(month + 1).padStart(2, "0")}-${String(dim).padStart(2, "0")}`,
  };
}

// ══════════════════════════════════
// PUANTAJ — istemciyle bire bir aynı hesaplar
// ══════════════════════════════════
export async function buildPuantajExport(deptId: string, year: number, month: number, group?: StaffGroup) {
  const { dept, people, hols, ids } = await loadBase(deptId, year, month, group);
  const groupLabel = group ? ` · ${staffGroupMeta(group).label}` : "";
  const deptName = dept?.name ?? "";
  const { dim, startD, endD } = monthRange(year, month);

  const [entries, schedules, overrides, leaves] = ids.length
    ? await Promise.all([
        db.select().from(timesheetEntries).where(and(inArray(timesheetEntries.personnelId, ids), gte(timesheetEntries.entryDate, startD), lte(timesheetEntries.entryDate, endD))),
        db.select().from(shiftSchedules).where(and(inArray(shiftSchedules.personnelId, ids), gte(shiftSchedules.scheduleDate, startD), lte(shiftSchedules.scheduleDate, endD))),
        db.select().from(weeklyOverrides).where(and(eq(weeklyOverrides.departmentId, deptId), eq(weeklyOverrides.periodYear, year), eq(weeklyOverrides.periodMonth, month))),
        db.select().from(leaveRequests).where(and(inArray(leaveRequests.personnelId, ids), eq(leaveRequests.status, "APPROVED"), lte(leaveRequests.startDate, endD), gte(leaveRequests.endDate, startD))),
      ])
    : [[], [], [], []] as const;

  const allDays = Array.from({ length: dim }, (_, i) => i + 1);
  const weeks = buildWeeks(year, month, dim);
  const holidayMap = new Map(hols.map(h => [h.holidayDate, h.name]));
  const fmt = (d: number) => fmtDate(year, month, d);
  const isHoliday = (d: number) => holidayMap.has(fmt(d));
  const getHours = (pid: string, d: number) =>
    entries.find(e => e.personnelId === pid && e.entryDate === fmt(d))?.hoursWorked || 0;
  const isOnLeaveDay = (pid: string, d: number) => {
    const date = fmt(d);
    return leaves.some(l => l.personnelId === pid && date >= l.startDate && date <= l.endDate);
  };
  const weekRequired = (wk: number[], ptype: string, pid?: string) =>
    Math.round(wk.filter(d => !isWeeklyRestDay(year, month, d) && !isHoliday(d) && (!pid || !isOnLeaveDay(pid, d))).length
      * requiredDailyHours(ptype) * 100) / 100;
  const weekWorked = (pid: string, wk: number[]) =>
    Math.round(wk.reduce((s, d) => s + getHours(pid, d), 0) * 100) / 100;
  const overtimeFor = (person: (typeof people)[number], days: number[]) => {
    let fmRaw = 0, bmRaw = 0, gm = 0;
    for (const d of days) {
      const hrs = getHours(person.id, d);
      if (isHoliday(d)) bmRaw += hrs;
      else if (isWeekendDay(year, month, d)) fmRaw += hrs;
      for (const s of schedules.filter(x => x.personnelId === person.id && x.scheduleDate === fmt(d))) {
        if (isNightRange(s.startTime, s.endTime)) gm += getShiftRangeMetrics(s.startTime, s.endTime).worked;
      }
    }
    return {
      fm: Math.round(fmRaw * 1.5 * 100) / 100,
      bm: Math.round(bmRaw * 2 * 100) / 100,
      gm: Math.round(gm * 100) / 100,
    };
  };
  const weekMetric = (pid: string, wi: number, wk: number[], field: "worked" | "night" | "extra" | "holiday") => {
    const ov = overrides.find(o => o.personnelId === pid && o.weekIndex === wi);
    const v = ov?.[field];
    if (v !== null && v !== undefined) return Number(v) || 0;
    if (field === "worked") return weekWorked(pid, wk);
    const person = people.find(p => p.id === pid);
    if (!person) return 0;
    return overtimeFor(person, wk)[field === "night" ? "gm" : field === "extra" ? "fm" : "bm"];
  };
  const monthStats = (person: (typeof people)[number]) => {
    const required = Math.round(allDays.filter(d => !isWeeklyRestDay(year, month, d) && !isHoliday(d) && !isOnLeaveDay(person.id, d)).length
      * requiredDailyHours(person.personnelType) * 100) / 100;
    const worked = Math.round(weeks.reduce((s, wk, i) => s + weekMetric(person.id, i, wk, "worked"), 0) * 100) / 100;
    const workDays = allDays.filter(d => getHours(person.id, d) > 0).length;
    return { required, worked, workDays, diff: Math.round((worked - required) * 100) / 100 };
  };

  // ── Puantaj sayfası (istek: mevcut Excel düzeniyle aynı) ──
  const rows: (string | number)[][] = [["PUANTAJ", `${deptName}${groupLabel} - ${MONTHS[month]} ${year}`], []];
  weeks.forEach((wk, wi) => {
    rows.push([`${wi + 1}. HAFTA`, `${wk[0]}-${wk[wk.length - 1]} ${MONTHS[month]}`]);
    rows.push(["Personel", "Sınıf", ...wk.map(d => `${d} ${dayName(year, month, d)}`), "Gereken", "Çalışılan", "Gece", "Fazla", "Bayram"]);
    people.forEach(p => {
      const ot = overtimeFor(p, wk);
      const row: (string | number)[] = [p.name, personnelTypeLabel(p.personnelType)];
      wk.forEach(d => {
        const entry = entries.find(e => e.personnelId === p.id && e.entryDate === fmt(d));
        const leave = entry ? LEAVE_CODE_MAP[entry.shiftType] : null;
        row.push(leave?.code || (entry?.hoursWorked || ""));
      });
      row.push(weekRequired(wk, p.personnelType, p.id), weekMetric(p.id, wi, wk, "worked"), ot.gm, ot.fm, ot.bm);
      rows.push(row);
    });
    rows.push([]);
  });
  rows.push(["AYLIK ÖZET"]);
  rows.push(["Personel", "Sınıf", "Gereken", "Çalışılan", "Gece", "Fazla Mesai", "Bayram", "Gün", "Fark"]);
  people.forEach(p => {
    const ms = monthStats(p);
    const ot = overtimeFor(p, allDays);
    rows.push([p.name, personnelTypeLabel(p.personnelType), ms.required, ms.worked, ot.gm, ot.fm, ot.bm, ms.workDays, ms.diff]);
  });
  rows.push([]);
  rows.push(["İMZALAR"]);
  rows.push([dept?.hemsireUnvan ?? "Sorumlu Hemşire", dept?.sorumluHemsire ?? ""]);
  rows.push([dept?.saglikBakimUnvan ?? "Sağlık Bakım Müdürü", dept?.saglikBakimMuduru ?? ""]);
  rows.push([dept?.bashekimUnvan ?? "Başhekim", dept?.bashekim ?? ""]);

  const mesai: (string | number)[][] = [["Personel", "Fazla Mesai (x1.5)", "Bayram Mesaisi (x2)", "Gece Mesaisi"]];
  people.forEach(p => {
    const o = overtimeFor(p, allDays);
    mesai.push([p.name, o.fm, o.bm, o.gm]);
  });

  // ── "Tüm Ay" sayfası: kişi başına TEK satır —
  //     tüm günler + her haftanın özeti + ay sonu özeti yan yana ──
  const tumAy: (string | number)[][] = [["TÜM AY PUANTAJ", `${deptName}${groupLabel} - ${MONTHS[month]} ${year}`], []];
  const tumAyHead: (string | number)[] = ["Personel", "Sınıf"];
  weeks.forEach((wk, wi) => {
    wk.forEach(d => tumAyHead.push(`${d} ${dayName(year, month, d)}`));
    tumAyHead.push(`H${wi + 1} Gereken`, `H${wi + 1} Çalışılan`, `H${wi + 1} Fark`, `H${wi + 1} Fazla`, `H${wi + 1} Gece`, `H${wi + 1} Bayram`);
  });
  tumAyHead.push("AY Gereken", "AY Çalışılan", "AY Gece", "AY Fazla", "AY Bayram", "AY Gün", "AY Fark");
  tumAy.push(tumAyHead);
  people.forEach(p => {
    const row: (string | number)[] = [p.name, personnelTypeLabel(p.personnelType)];
    weeks.forEach((wk, wi) => {
      wk.forEach(d => {
        const entry = entries.find(e => e.personnelId === p.id && e.entryDate === fmt(d));
        const leave = entry ? LEAVE_CODE_MAP[entry.shiftType] : null;
        row.push(leave?.code || (entry?.hoursWorked || ""));
      });
      const wReq = weekRequired(wk, p.personnelType, p.id);
      const wWrk = weekMetric(p.id, wi, wk, "worked");
      const wOt = overtimeFor(p, wk);
      row.push(wReq, wWrk, Math.round((wWrk - wReq) * 100) / 100, wOt.fm, wOt.gm, wOt.bm);
    });
    const ms = monthStats(p);
    const mOt = overtimeFor(p, allDays);
    row.push(ms.required, ms.worked, mOt.gm, mOt.fm, mOt.bm, ms.workDays, ms.diff);
    tumAy.push(row);
  });
  tumAy.push([]);
  tumAy.push([dept?.hemsireUnvan ?? "Sorumlu Hemşire", dept?.sorumluHemsire ?? ""]);
  tumAy.push([dept?.saglikBakimUnvan ?? "Sağlık Bakım Müdürü", dept?.saglikBakimMuduru ?? ""]);
  tumAy.push([dept?.bashekimUnvan ?? "Başhekim", dept?.bashekim ?? ""]);

  const sheets = [
    { name: "Tüm Ay", rows: tumAy },
    { name: "Puantaj", rows },
    { name: "Mesai Özeti", rows: mesai },
  ];

  // ── CSV düzeni ──
  const header: (string | number)[] = ["Personel", "Sınıf"];
  weeks.forEach((wk, wi) => {
    wk.forEach(d => header.push(String(d)));
    header.push(`H${wi + 1} Ger.`, `H${wi + 1} Çal.`, `H${wi + 1} Fark`);
  });
  header.push("Ay Ger.", "Ay Çal.", "Gün", "Fark");
  const csvRows: (string | number)[][] = [header, ...people.map(p => {
    const row: (string | number)[] = [p.name, personnelTypeLabel(p.personnelType)];
    weeks.forEach((wk, wi) => {
      wk.forEach(d => row.push(String(getHours(p.id, d) || "")));
      const r = weekRequired(wk, p.personnelType, p.id), w = weekMetric(p.id, wi, wk, "worked");
      row.push(String(r), String(w), String(Math.round((w - r) * 100) / 100));
    });
    const ms = monthStats(p);
    row.push(String(ms.required), String(ms.worked), String(ms.workDays), String(ms.diff));
    return row;
  })];

  return { deptName, sheets, csvRows };
}

// ══════════════════════════════════
// NÖBET
// ══════════════════════════════════
export async function buildNobetExport(deptId: string, year: number, month: number, group: StaffGroup = "SAGLIK") {
  const { dept, people, hols, ids } = await loadBase(deptId, year, month, group);
  const groupLabel = ` · ${staffGroupMeta(group).label}`;
  const deptName = dept?.name ?? "";
  const { dim, startD, endD } = monthRange(year, month);
  const allDays = Array.from({ length: dim }, (_, i) => i + 1);
  const holidaySet = new Set(hols.map(h => h.holidayDate));
  const { ensureColumns } = await import("@/lib/server/roster");
  const columns = await ensureColumns(deptId, year, month, group);
  const schedules = ids.length
    ? await db.select().from(shiftSchedules).where(and(inArray(shiftSchedules.personnelId, ids), gte(shiftSchedules.scheduleDate, startD), lte(shiftSchedules.scheduleDate, endD)))
    : [];
  const fmt = (d: number) => fmtDate(year, month, d);
  const personName = (id: string) => people.find(p => p.id === id)?.name ?? "?";
  const colHeader = (c: { service: string; shiftLabel: string }) =>
    c.service ? `${c.service} (${c.shiftLabel})` : c.shiftLabel;
  const recordFor = (d: number, key: string) =>
    schedules.find(s => s.scheduleDate === fmt(d) && String((s as { columnKey?: string | null }).columnKey ?? "") === key);

  function calcStats(person: (typeof people)[number]) {
    const required = Math.round(allDays.filter(d => !isWeeklyRestDay(year, month, d) && !holidaySet.has(fmt(d))).length
      * requiredDailyHours(person.personnelType) * 100) / 100;
    let worked = 0, nightHours = 0, extraHours = 0, holidayHours = 0, workDays = 0;
    schedules.filter(s => s.personnelId === person.id).forEach(s => {
      const hrs = getShiftRangeMetrics(s.startTime, s.endTime).worked;
      if (hrs <= 0) return;
      const day = parseInt(s.scheduleDate.slice(-2));
      if (isNightRange(s.startTime, s.endTime)) nightHours += hrs;
      worked += hrs;
      if (holidaySet.has(s.scheduleDate)) holidayHours += hrs;
      if (isWeekendDay(year, month, day) || holidaySet.has(s.scheduleDate)) extraHours += hrs;
      workDays++;
    });
    const r2 = (n: number) => Math.round(n * 100) / 100;
    return { required, worked: r2(worked), nightHours: r2(nightHours), extraHours: r2(extraHours), holidayHours: r2(holidayHours), workDays, diff: r2(worked - required) };
  }

  const rows: (string | number)[][] = [["NÖBET ÇİZELGESİ", `${deptName}${groupLabel} - ${MONTHS[month]} ${year}`], []];
  const head = ["Tarih", "Gün", ...columns.map(colHeader)];
  rows.push(head);
  const csvRows: (string | number)[][] = [head];
  allDays.forEach(d => {
    const dayNameTr = DAYS_FULL[new Date(year, month, d).getDay()];
    const hol = holidaySet.has(fmt(d)) ? ` (${hols.find(h => h.holidayDate === fmt(d))?.name ?? ""})` : "";
    const line: (string | number)[] = [fmt(d), `${dayNameTr}${hol}`];
    columns.forEach(c => {
      const rec = recordFor(d, c.key);
      line.push(rec ? personName(rec.personnelId) : "");
    });
    rows.push(line);
    csvRows.push(line);
  });
  rows.push([]);
  rows.push(["PERSONEL ÖZETİ"]);
  rows.push(["Personel", "Gereken", "Çalışılan", "Gece", "Fark", "Gün"]);
  people.forEach(p => {
    const st = calcStats(p);
    rows.push([p.name, st.required, st.worked, st.nightHours, st.diff, st.workDays]);
  });
  rows.push([]);
  rows.push([dept?.hemsireUnvan ?? "Sorumlu Hemşire", dept?.sorumluHemsire ?? ""]);
  rows.push([dept?.saglikBakimUnvan ?? "Sağlık Bakım Müdürü", dept?.saglikBakimMuduru ?? ""]);
  rows.push([dept?.bashekimUnvan ?? "Başhekim", dept?.bashekim ?? ""]);

  return { deptName, rows, csvRows };
}

// ══════════════════════════════════
// İZİNLER
// ══════════════════════════════════
export async function buildIzinlerExport(deptId: string, year: number, status?: string) {
  const { dept, people, ids } = await loadBase(deptId, year, 0);
  const deptName = dept?.name ?? "";
  let leaves = ids.length ? await db.select().from(leaveRequests).where(inArray(leaveRequests.personnelId, ids)) : [];
  if (status && status !== "ALL") leaves = leaves.filter(l => l.status === status);
  leaves.sort((a, b) => (b.createdAt?.toString() ?? "").localeCompare(a.createdAt?.toString() ?? ""));
  const persMap = new Map(people.map(p => [p.id, p]));
  const STATUS_LABEL: Record<string, string> = { PENDING: "Bekliyor", APPROVED: "Onaylandı", REJECTED: "Reddedildi", CANCELLED: "İptal" };

  const rows: (string | number)[][] = [["İZİN KAYITLARI", `${deptName} — ${year}`], []];
  rows.push(["Personel", "İzin Türü", "Başlangıç", "Bitiş", "Gün", "Durum", "Aşama", "Gerekçe"]);
  leaves.forEach(l => {
    rows.push([
      persMap.get(l.personnelId)?.name ?? "?",
      LEAVE_CODE_MAP[l.leaveType]?.label ?? l.leaveType,
      fmtTr(l.startDate), fmtTr(l.endDate), l.daysCount,
      STATUS_LABEL[l.status] ?? l.status,
      l.status === "APPROVED" ? "Tamamlandı" : APPROVAL_FLOW.find(f => f.stage === l.approvalStage)?.short ?? "-",
      l.reason ?? "",
    ]);
  });
  return { deptName, rows };
}

// ══════════════════════════════════
// PERSONEL LİSTESİ (Personel Yönetim Sistemi dışa aktarımı)
// ══════════════════════════════════
export async function buildPersonelExport(opts: { dept?: string; type?: string; status?: string; q?: string }) {
  const [allPeople, assignments, depts] = await Promise.all([
    db.select().from(personnel),
    db.select().from(personnelDepartments),
    db.select().from(departments),
  ]);
  const deptName = (id: string | null) => depts.find(d => d.id === id)?.name ?? "—";
  const q = (opts.q ?? "").trim().toLocaleLowerCase("tr");
  let list = allPeople.map(p => ({
    ...p,
    deptIds: assignments.filter(a => a.personnelId === p.id).map(a => a.departmentId),
  }));
  if (opts.dept && opts.dept !== "ALL") {
    list = list.filter(p => p.departmentId === opts.dept || p.deptIds.includes(opts.dept!));
  }
  if (opts.type && opts.type !== "ALL") list = list.filter(p => p.personnelType === opts.type);
  if (opts.status === "ACTIVE") list = list.filter(p => p.isActive);
  else if (opts.status === "PASSIVE") list = list.filter(p => !p.isActive);
  if (q) {
    list = list.filter(p =>
      p.name.toLocaleLowerCase("tr").includes(q) ||
      (p.title ?? "").toLocaleLowerCase("tr").includes(q) ||
      (p.tcNo ?? "").includes(q));
  }
  list.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, "tr"));

  const rows: (string | number)[][] = [["PERSONEL LİSTESİ", `${list.length} kayıt`], []];
  rows.push(["Ad Soyad", "TC Kimlik No", "Sınıf", "Ünvan", "Ana Departman", "Departmanlar", "Telefon", "E-posta", "Acil Durum", "İşe Başlama", "Yıllık İzin", "Rapor", "Ücretsiz", "Durum", "Notlar"]);
  list.forEach(p => {
    rows.push([
      p.name, p.tcNo ?? "", personnelTypeLabel(p.personnelType), p.title ?? "",
      deptName(p.departmentId), p.deptIds.map(deptName).join(", "),
      p.phone ?? "", p.email ?? "", p.emergencyContact ?? "",
      p.startDate ? fmtTr(p.startDate) : "",
      p.annualLeaveBalance ?? "", p.sickLeaveBalance ?? "", p.unpaidLeaveBalance ?? "",
      p.isActive ? "Aktif" : "Pasif", p.notes ?? "",
    ]);
  });
  return { rows, count: list.length };
}

// ══════════════════════════════════
// Yanıt üreticiler
// ══════════════════════════════════
export function xlsxResponse(sheets: { name: string; rows: (string | number)[][] }[], filename: string) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(s => {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    const widths = Array.from({ length: Math.max(...s.rows.map(r => r.length), 1) }, (_, ci) => {
      const longest = Math.max(...s.rows.map(r => String(r[ci] ?? "").length), 0);
      return { wch: Math.min(32, Math.max(10, longest + 2)) };
    });
    ws["!cols"] = widths;
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 30));
  });
  // "array" çıktısı hem Node.js hem tarayıcıda (GitHub Pages sürümü) çalışır;
  // Buffer bağımlılığı yoktur.
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Response(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    },
  });
}

function csvCell(v: string | number | null | undefined) {
  const t = String(v ?? "");
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function csvResponse(rows: (string | number)[][], filename: string) {
  const csv = "\uFEFF" + rows.map(r => r.map(csvCell).join(";")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    },
  });
}
