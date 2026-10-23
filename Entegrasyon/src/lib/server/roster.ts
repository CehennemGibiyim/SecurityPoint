import { db } from "@/db";
import {
  departments, dutyColumns, shiftSchedules, leaveRequests, shiftTemplates, personnel,
  personnelDepartments,
} from "@/db/schema";
import { and, eq, gte, lte, inArray, asc, desc } from "drizzle-orm";
import { dutyColumnKey, normalizeTemplateColumns, type DutyColumn, type StaffGroup } from "@/lib/shared";
import { rangesOverlap, staffGroupMeta } from "@/lib/shared";
import { syncTimesheetFromSchedules } from "@/lib/server/core";

// ═════════════════════════════════════════════════════════════
// Nöbet çizelgesi ızgarası — dönem (ay) + PERSONEL GRUBU bazlı sütun yönetimi
// Her servisin, her ay ve her grup (Hemşire/Sağlık · Temizlik/Destek) için
// ayrı sütun düzeni ve ayrı atamaları vardır; geçmiş aylar korunur.
// Sütun anahtarları (key) bir servis+ay içinde gruplar arasında da benzersizdir,
// böylece atama → sütun eşleşmesi hiçbir zaman karışmaz.
// ═════════════════════════════════════════════════════════════

export type Period = { year: number; month: number };

function monthRange(p: Period) {
  const dim = new Date(p.year, p.month + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dim,
    startD: `${p.year}-${pad(p.month + 1)}-01`,
    endD: `${p.year}-${pad(p.month + 1)}-${pad(dim)}`,
  };
}

function periodOf(date: string): Period {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 };
}

/** Dönemin sütunları; group verilirse yalnızca o grubun sütunları. */
export async function getColumns(deptId: string, year: number, month: number, group?: StaffGroup): Promise<DutyColumn[]> {
  const conds = [
    eq(dutyColumns.departmentId, deptId),
    eq(dutyColumns.periodYear, year),
    eq(dutyColumns.periodMonth, month),
  ];
  if (group) conds.push(eq(dutyColumns.staffGroup, group));
  return db.select().from(dutyColumns).where(and(...conds)).orderBy(asc(dutyColumns.position));
}

function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}¦${i}`)) i++;
  return `${base}¦${i}`;
}

/** Servisteki bir grubun (aktif/pasif tüm) personel kimlikleri. */
async function groupPersonnelIds(deptId: string, group: StaffGroup): Promise<Set<string>> {
  const members = await db.select({ pid: personnelDepartments.personnelId })
    .from(personnelDepartments).where(eq(personnelDepartments.departmentId, deptId));
  const memberIds = new Set(members.map(m => m.pid));
  const rows = await db.select({ id: personnel.id, dep: personnel.departmentId })
    .from(personnel).where(eq(personnel.staffGroup, group));
  return new Set(rows.filter(r => memberIds.has(r.id) || r.dep === deptId).map(r => r.id));
}

export async function addColumn(deptId: string, year: number, month: number, input: {
  service: string; shiftLabel?: string; startTime: string; endTime: string;
}, group: StaffGroup = "SAGLIK"): Promise<DutyColumn> {
  const service = input.service.trim();
  const label = (input.shiftLabel?.trim() || `${input.startTime}–${input.endTime}`);
  if (!service || !label) throw new Error("Hizmet ve saat etiketi gerekli");
  const all = await getColumns(deptId, year, month);
  const mine = all.filter(c => c.staffGroup === group);
  const key = uniqueKey(dutyColumnKey(service, label), new Set(all.map(c => c.key)));
  const position = mine.length ? Math.max(...mine.map(c => c.position)) + 1 : 0;
  const rows = await db.insert(dutyColumns).values({
    departmentId: deptId, periodYear: year, periodMonth: month, staffGroup: group,
    key, service, shiftLabel: label,
    startTime: input.startTime, endTime: input.endTime, position,
  }).returning();
  return rows[0];
}

/**
 * Sütunu günceller; key sabit kalır, aynı döneme ait bağlı kayıtların
 * saat/etiket bilgileri yeni değerlerle güncellenir ve puantajları senkronlanır.
 */
export async function updateColumn(id: string, input: {
  service?: string; shiftLabel?: string; startTime?: string; endTime?: string;
}): Promise<DutyColumn> {
  const current = (await db.select().from(dutyColumns).where(eq(dutyColumns.id, id)))[0];
  if (!current) throw new Error("Sütun bulunamadı");
  const patch: Partial<typeof current> = {};
  if (input.service !== undefined) patch.service = input.service.trim();
  if (input.shiftLabel !== undefined) patch.shiftLabel = input.shiftLabel.trim();
  if (input.startTime !== undefined) patch.startTime = input.startTime;
  if (input.endTime !== undefined) patch.endTime = input.endTime;
  const rows = await db.update(dutyColumns).set(patch).where(eq(dutyColumns.id, id)).returning();
  const col = rows[0];

  const { startD, endD } = monthRange({ year: col.periodYear, month: col.periodMonth });
  const label = col.shiftLabel || `${col.startTime}–${col.endTime}`;
  const linked = await db.select().from(shiftSchedules).where(and(
    eq(shiftSchedules.departmentId, col.departmentId),
    eq(shiftSchedules.columnKey, col.key),
    gte(shiftSchedules.scheduleDate, startD), lte(shiftSchedules.scheduleDate, endD),
  ));
  for (const s of linked) {
    await db.update(shiftSchedules).set({
      startTime: col.startTime, endTime: col.endTime,
      shiftLabel: `${col.service} (${label})`,
      updatedAt: new Date(),
    }).where(eq(shiftSchedules.id, s.id));
  }
  await syncTouched(linked);
  return col;
}

export async function moveColumn(id: string, direction: "up" | "down"): Promise<DutyColumn[]> {
  const current = (await db.select().from(dutyColumns).where(eq(dutyColumns.id, id)))[0];
  if (!current) throw new Error("Sütun bulunamadı");
  const group = current.staffGroup as StaffGroup;
  const cols = await getColumns(current.departmentId, current.periodYear, current.periodMonth, group);
  const idx = cols.findIndex(c => c.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= cols.length) return cols;
  const a = cols[idx], b = cols[swapIdx];
  await db.update(dutyColumns).set({ position: b.position }).where(eq(dutyColumns.id, a.id));
  await db.update(dutyColumns).set({ position: a.position }).where(eq(dutyColumns.id, b.id));
  return getColumns(current.departmentId, current.periodYear, current.periodMonth, group);
}

/** Sütunu ve aynı döneme ait bağlı atamaları siler; puantajlar senkronlanır. */
export async function removeColumn(id: string) {
  const current = (await db.select().from(dutyColumns).where(eq(dutyColumns.id, id)))[0];
  if (!current) throw new Error("Sütun bulunamadı");
  const { startD, endD } = monthRange({ year: current.periodYear, month: current.periodMonth });
  const linked = await db.select().from(shiftSchedules).where(and(
    eq(shiftSchedules.departmentId, current.departmentId),
    eq(shiftSchedules.columnKey, current.key),
    gte(shiftSchedules.scheduleDate, startD), lte(shiftSchedules.scheduleDate, endD),
  ));
  for (const s of linked) await db.delete(shiftSchedules).where(eq(shiftSchedules.id, s.id));
  await db.delete(dutyColumns).where(eq(dutyColumns.id, id));
  await syncTouched(linked);
  return { removedAssignments: linked.length };
}

async function syncTouched(rows: { personnelId: string; scheduleDate: string }[]) {
  const touched = new Map<string, Set<string>>();
  rows.forEach(s => {
    if (!touched.has(s.personnelId)) touched.set(s.personnelId, new Set());
    touched.get(s.personnelId)!.add(s.scheduleDate);
  });
  for (const [pid, dates] of touched) for (const dt of dates) await syncTimesheetFromSchedules(pid, dt);
}

/** Grubun varsayılan sütun düzeni (hiç düzen yoksa). */
function defaultLayout(group: StaffGroup, deptName: string) {
  if (group === "DESTEK") {
    return [
      { service: "Temizlik", shiftLabel: "07:00–19:00", startTime: "07:00", endTime: "19:00" },
      { service: "Temizlik", shiftLabel: "19:00–07:00", startTime: "19:00", endTime: "07:00" },
      { service: "Temizlik", shiftLabel: "08:00–16:00", startTime: "08:00", endTime: "16:00" },
    ];
  }
  const service = group === "SAGLIK" ? deptName : staffGroupMeta(group).short;
  return [
    { service, shiftLabel: "08:00–20:00", startTime: "08:00", endTime: "20:00" },
    { service, shiftLabel: "20:00–08:00", startTime: "20:00", endTime: "08:00" },
  ];
}

/**
 * Sütun güvencesi (grup bazlı):
 * 1) Grubun bu dönemde kayıtlı sütunları varsa onları döndür.
 * 2) Yoksa grubun personelinin bu dönemdeki kayıtlarından sütun türet.
 * 3) O da yoksa grubun en son dönemdeki düzenini kopyala.
 * 4) (Sağlık grubu) servise uygun son şablonu kur.
 * 5) Grubun varsayılan düzenini oluştur.
 */
export async function ensureColumns(deptId: string, year: number, month: number, group: StaffGroup = "SAGLIK"): Promise<DutyColumn[]> {
  const existing = await getColumns(deptId, year, month, group);
  if (existing.length) return existing;

  const all = await getColumns(deptId, year, month);
  const taken = new Set(all.map(c => c.key));
  const otherKeys = new Set(all.map(c => c.key));
  const dept = (await db.select().from(departments).where(eq(departments.id, deptId)))[0];
  const deptName = dept?.name ?? "Genel Servis";
  const { startD, endD } = monthRange({ year, month });

  // 2) Grubun bu dönemdeki kayıtlarından türet
  const pids = await groupPersonnelIds(deptId, group);
  const rows = (await db.select().from(shiftSchedules).where(and(
    eq(shiftSchedules.departmentId, deptId),
    gte(shiftSchedules.scheduleDate, startD), lte(shiftSchedules.scheduleDate, endD)))
    .orderBy(asc(shiftSchedules.scheduleDate), asc(shiftSchedules.startTime)))
    .filter(r => pids.has(r.personnelId) && !(r.columnKey && otherKeys.has(r.columnKey)));
  if (rows.length) {
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const gk = r.columnKey ?? `NULL|${r.startTime}|${r.endTime}|${r.shiftLabel}`;
      if (!groups.has(gk)) groups.set(gk, []);
      groups.get(gk)!.push(r);
    }
    let pos = 0;
    for (const [gk, items] of groups) {
      const rep = items[0];
      const start = rep.startTime ?? "08:00";
      const end = rep.endTime ?? "16:00";
      let key: string, svc: string, label: string;
      if (!gk.startsWith("NULL|")) {
        const parts = gk.split("¦");
        svc = parts[0] || deptName;
        label = parts.slice(1).join("¦") || `${start}–${end}`;
        key = gk;
        if (taken.has(key)) {
          key = uniqueKey(dutyColumnKey(svc, label), taken);
          await db.update(shiftSchedules).set({ columnKey: key }).where(inArray(shiftSchedules.id, items.map(x => x.id)));
        }
      } else {
        const m = String(rep.shiftLabel ?? "").match(/^(.*)\s+\(([^)]+)\)$/);
        if (m) { svc = m[1].trim() || deptName; label = m[2].trim(); }
        else {
          svc = deptName;
          label = String(rep.shiftLabel ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim() || `${start}–${end}`;
        }
        key = uniqueKey(dutyColumnKey(svc, label), taken);
        await db.update(shiftSchedules).set({ columnKey: key }).where(inArray(shiftSchedules.id, items.map(x => x.id)));
      }
      taken.add(key);
      await db.insert(dutyColumns).values({
        departmentId: deptId, periodYear: year, periodMonth: month, staffGroup: group,
        key, service: svc, shiftLabel: label, startTime: start, endTime: end, position: pos++,
      }).onConflictDoNothing();
    }
    return getColumns(deptId, year, month, group);
  }

  // 3) Grubun en son dönemdeki düzenini kopyala
  const latest = await db.select().from(dutyColumns)
    .where(and(eq(dutyColumns.departmentId, deptId), eq(dutyColumns.staffGroup, group)))
    .orderBy(desc(dutyColumns.periodYear), desc(dutyColumns.periodMonth), asc(dutyColumns.position))
    .limit(30);
  if (latest.length) {
    const ly = latest[0].periodYear, lm = latest[0].periodMonth;
    const layout = latest.filter(c => c.periodYear === ly && c.periodMonth === lm);
    for (const c of layout) {
      const key = uniqueKey(c.key, taken);
      taken.add(key);
      await db.insert(dutyColumns).values({
        departmentId: deptId, periodYear: year, periodMonth: month, staffGroup: group,
        key, service: c.service, shiftLabel: c.shiftLabel,
        startTime: c.startTime, endTime: c.endTime, position: c.position,
      }).onConflictDoNothing();
    }
    return getColumns(deptId, year, month, group);
  }

  // 4) Sağlık grubu: son şablon
  if (group === "SAGLIK") {
    const templates = await db.select().from(shiftTemplates);
    const usable = templates
      .filter(t => !t.departmentId || t.departmentId === deptId)
      .map(t => normalizeTemplateColumns(t.slots))
      .filter(cols => cols.length > 0);
    if (usable.length) {
      await replaceColumns(deptId, usable[usable.length - 1], false, { year, month }, group);
      return getColumns(deptId, year, month, group);
    }
  }

  // 5) Varsayılan düzen
  await replaceColumns(deptId, defaultLayout(group, deptName), false, { year, month }, group);
  return getColumns(deptId, year, month, group);
}

/**
 * Grubun dönem sütun düzenini baştan kurar (şablon uygulama).
 * clearAssignments=true ise YALNIZCA o grubun o dönemdeki atamaları silinir;
 * diğer grubun çizelgesine dokunulmaz.
 */
export async function replaceColumns(
  deptId: string,
  cols: { service: string; shiftLabel: string; startTime: string; endTime: string }[],
  clearAssignments: boolean,
  scope: Period,
  group: StaffGroup = "SAGLIK",
) {
  const { startD, endD } = monthRange(scope);
  const mine = await getColumns(deptId, scope.year, scope.month, group);
  if (clearAssignments) {
    const pids = await groupPersonnelIds(deptId, group);
    const myKeys = new Set(mine.map(c => c.key));
    const linked = (await db.select({ id: shiftSchedules.id, personnelId: shiftSchedules.personnelId, scheduleDate: shiftSchedules.scheduleDate, columnKey: shiftSchedules.columnKey })
      .from(shiftSchedules).where(and(
        eq(shiftSchedules.departmentId, deptId),
        gte(shiftSchedules.scheduleDate, startD), lte(shiftSchedules.scheduleDate, endD))))
      .filter(s => (s.columnKey && myKeys.has(s.columnKey)) || pids.has(s.personnelId));
    if (linked.length) await db.delete(shiftSchedules).where(inArray(shiftSchedules.id, linked.map(s => s.id)));
    await syncTouched(linked);
  }
  await db.delete(dutyColumns).where(and(
    eq(dutyColumns.departmentId, deptId),
    eq(dutyColumns.periodYear, scope.year),
    eq(dutyColumns.periodMonth, scope.month),
    eq(dutyColumns.staffGroup, group),
  ));
  if (!cols.length) return [];
  const others = await getColumns(deptId, scope.year, scope.month);
  const taken = new Set(others.map(c => c.key));
  const created: DutyColumn[] = [];
  let pos = 0;
  for (const c of cols) {
    const svc = c.service.trim() || "Genel Servis";
    const label = c.shiftLabel.trim() || `${c.startTime}–${c.endTime}`;
    const key = uniqueKey(dutyColumnKey(svc, label), taken);
    taken.add(key);
    const ins = await db.insert(dutyColumns).values({
      departmentId: deptId, periodYear: scope.year, periodMonth: scope.month, staffGroup: group,
      key, service: svc, shiftLabel: label,
      startTime: c.startTime, endTime: c.endTime, position: pos++,
    }).returning();
    created.push(ins[0]);
  }
  return created;
}

// ═════════════════════════════════════════════════════════════
// Hücre ataması
// ═════════════════════════════════════════════════════════════

export async function setRosterCell(deptId: string, date: string, columnKey: string, personnelId: string | null) {
  const p = periodOf(date);
  const col = (await db.select().from(dutyColumns).where(and(
    eq(dutyColumns.departmentId, deptId),
    eq(dutyColumns.periodYear, p.year), eq(dutyColumns.periodMonth, p.month),
    eq(dutyColumns.key, columnKey))))[0];
  if (!col) throw new Error("Sütun bulunamadı");

  if (personnelId) {
    // Grup koruması: hemşire çizelgesine temizlik personeli (veya tersi) atanamaz
    const person = (await db.select({ g: personnel.staffGroup }).from(personnel).where(eq(personnel.id, personnelId)))[0];
    if (person && person.g !== col.staffGroup) {
      const gm = staffGroupMeta(col.staffGroup);
      throw Object.assign(new Error(`Bu sütun ${gm.label} çizelgesine ait; farklı gruptaki personel atanamaz.`), { status: 409 });
    }
  }

  const old = await db.select().from(shiftSchedules).where(and(
    eq(shiftSchedules.departmentId, deptId),
    eq(shiftSchedules.scheduleDate, date),
    eq(shiftSchedules.columnKey, columnKey),
  ));
  for (const s of old) await db.delete(shiftSchedules).where(eq(shiftSchedules.id, s.id));

  let created = null;
  if (personnelId) {
    const leave = await db.select().from(leaveRequests).where(and(
      eq(leaveRequests.personnelId, personnelId), eq(leaveRequests.status, "APPROVED"),
      lte(leaveRequests.startDate, date), gte(leaveRequests.endDate, date))).limit(1);
    if (leave.length) throw Object.assign(new Error("Onaylı izinli personel nöbete atanamaz."), { status: 409 });

    const sameDay = await db.select().from(shiftSchedules).where(and(
      eq(shiftSchedules.personnelId, personnelId), eq(shiftSchedules.scheduleDate, date)));
    for (const s of sameDay) {
      if (s.startTime && s.endTime && rangesOverlap(col.startTime, col.endTime, s.startTime, s.endTime)) {
        throw Object.assign(new Error(
          `Çakışma! Bu personelin ${date} tarihinde ${s.startTime?.slice(0, 5)}–${s.endTime?.slice(0, 5)} vardiyası zaten var.`), { status: 409 });
      }
    }

    const label = col.shiftLabel || `${col.startTime}–${col.endTime}`;
    const ins = await db.insert(shiftSchedules).values({
      departmentId: deptId, scheduleDate: date, personnelId,
      shiftSlot: "CUSTOM", shiftLabel: `${col.service} (${label})`,
      startTime: col.startTime, endTime: col.endTime, columnKey: col.key,
    }).returning();
    created = ins[0];
  }

  await syncTouched(old);
  if (created) await syncTimesheetFromSchedules(created.personnelId, created.scheduleDate);
  return { schedule: created, removed: old.length };
}

// ═════════════════════════════════════════════════════════════
// Dengeli taslak — yalnızca seçili grubun personeli ve sütunlarıyla
// ═════════════════════════════════════════════════════════════

export async function createDraft(deptId: string, year: number, month: number, overwrite: boolean, group: StaffGroup = "SAGLIK") {
  const columns = await ensureColumns(deptId, year, month, group);
  if (!columns.length) throw new Error("Önce nöbet sütunu tanımlayın");
  const { dim, startD, endD } = monthRange({ year, month });
  const colKeys = new Set(columns.map(c => c.key));

  const people = await db.select().from(personnel).where(and(eq(personnel.isActive, true), eq(personnel.staffGroup, group)));
  const members = await db.select().from(personnelDepartments).where(eq(personnelDepartments.departmentId, deptId));
  const memberIds = new Set(members.map(m => m.personnelId));
  const roster = people
    .filter(p => memberIds.has(p.id) || p.departmentId === deptId)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  if (!roster.length) {
    throw new Error(`Bu serviste aktif ${staffGroupMeta(group).label.toLocaleLowerCase("tr")} yok. Personel Yönetimi'nden ekleyin.`);
  }
  const rosterIds = new Set(roster.map(p => p.id));

  let existing = (await db.select().from(shiftSchedules).where(and(
    eq(shiftSchedules.departmentId, deptId),
    gte(shiftSchedules.scheduleDate, startD), lte(shiftSchedules.scheduleDate, endD))))
    .filter(s => (s.columnKey && colKeys.has(s.columnKey)) || rosterIds.has(s.personnelId));
  if (existing.length && !overwrite) {
    throw Object.assign(new Error("Ayda kayıtlar var. Taslak için önce mevcut kayıtları temizleyin."), { status: 409 });
  }
  const removed = existing;
  if (overwrite && existing.length) {
    await db.delete(shiftSchedules).where(inArray(shiftSchedules.id, existing.map(s => s.id)));
    existing = [];
  }

  const leaves = await db.select().from(leaveRequests).where(and(
    inArray(leaveRequests.personnelId, roster.map(p => p.id)),
    eq(leaveRequests.status, "APPROVED"),
    lte(leaveRequests.startDate, endD), gte(leaveRequests.endDate, startD)));
  const isOnLeave = (pid: string, date: string) =>
    leaves.some(l => l.personnelId === pid && date >= l.startDate && date <= l.endDate);

  const preUsed = new Map<string, Set<string>>();
  const preByDay = new Map<string, Set<string>>();
  existing.forEach(s => {
    if (!preUsed.has(s.scheduleDate)) { preUsed.set(s.scheduleDate, new Set()); preByDay.set(s.scheduleDate, new Set()); }
    if (s.columnKey) preUsed.get(s.scheduleDate)!.add(s.columnKey);
    preByDay.get(s.scheduleDate)!.add(s.personnelId);
  });

  const counts = new Map<string, number>(roster.map(p => [p.id, existing.filter(s => s.personnelId === p.id).length]));
  const lastDay = new Map<string, number>();
  existing.forEach(s => {
    const d = Number(s.scheduleDate.slice(8, 10));
    if (!lastDay.has(s.personnelId) || lastDay.get(s.personnelId)! < d) lastDay.set(s.personnelId, d);
  });

  let placed = 0, skipped = 0;
  const createdRows: { personnelId: string; scheduleDate: string }[] = [];
  for (let day = 1; day <= dim; day++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const usedToday = new Set(preByDay.get(date) ?? []);
    for (const col of columns) {
      if (preUsed.get(date)?.has(col.key)) continue;
      const candidates = roster.filter(p => !usedToday.has(p.id) && !isOnLeave(p.id, date));
      if (!candidates.length) { skipped++; continue; }
      candidates.sort((a, b) => {
        const restA = lastDay.has(a.id) && day - lastDay.get(a.id)! <= 1 ? 1 : 0;
        const restB = lastDay.has(b.id) && day - lastDay.get(b.id)! <= 1 ? 1 : 0;
        return restA - restB
          || (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0)
          || a.name.localeCompare(b.name, "tr");
      });
      const person = candidates[0];
      const label = col.shiftLabel || `${col.startTime}–${col.endTime}`;
      await db.insert(shiftSchedules).values({
        departmentId: deptId, scheduleDate: date, personnelId: person.id,
        shiftSlot: "CUSTOM", shiftLabel: `${col.service} (${label})`,
        startTime: col.startTime, endTime: col.endTime, columnKey: col.key,
      });
      createdRows.push({ personnelId: person.id, scheduleDate: date });
      usedToday.add(person.id);
      counts.set(person.id, (counts.get(person.id) ?? 0) + 1);
      lastDay.set(person.id, day);
      placed++;
    }
  }
  await syncTouched([...createdRows, ...(overwrite ? removed : [])]);
  return { placed, skipped, columns: columns.length };
}
