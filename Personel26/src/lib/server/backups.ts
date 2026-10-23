import { db } from "@/db";
import { departments, holidays, personnel, shiftTemplates, shiftSchedules, leaveRequests, shiftSwapRequests, timesheetEntries, personnelDepartments, weeklyOverrides, announcements, dutyColumns, appSettings, activityLogs, dbBackups } from "@/db/schema";
import { and, eq, gte, desc, inArray, getTableColumns, getTableName } from "drizzle-orm";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import { getSettings, logActivity } from "@/lib/server/settings";
import { DEFAULT_SETTINGS, validateSettings } from "@/lib/settings";
export const BACKUP_TABLES = {
  departments, holidays, personnel, shift_templates: shiftTemplates, duty_columns: dutyColumns,
  personnel_departments: personnelDepartments, shift_schedules: shiftSchedules, leave_requests: leaveRequests,
  shift_swap_requests: shiftSwapRequests, timesheet_entries: timesheetEntries, weekly_overrides: weeklyOverrides,
  announcements, app_settings: appSettings, activity_logs: activityLogs,
};
const keys = Object.keys(BACKUP_TABLES) as (keyof typeof BACKUP_TABLES)[];
export const DELETE_ORDER = ["timesheet_entries", "shift_swap_requests", "leave_requests", "shift_schedules", "duty_columns", "weekly_overrides", "announcements", "personnel_departments", "shift_templates", "personnel", "departments", "holidays", "app_settings", "activity_logs"] as const;
export type BackupPayload = Record<string, Record<string, unknown>[]>;
export function validateBackup(input: unknown): BackupPayload {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Geçersiz yedek dosyası.");
  const object = input as Record<string, unknown>;
  const source = object.format === "personel26" ? object.data as Record<string, unknown> : object;
  if (!source || typeof source !== "object") throw new Error("Yedek verisi eksik.");
  const required = keys.filter(key => !["app_settings", "activity_logs", "duty_columns"].includes(key));
  for (const key of required) if (!Array.isArray(source[key])) throw new Error(`Yedekte ${key} tablosu eksik. Geri yükleme yapılmadı.`);
  const output: BackupPayload = {};
  let total = 0;
  for (const key of keys) {
    if (source[key] === undefined) continue;
    const rows = source[key];
    if (!Array.isArray(rows) || rows.length > 100000) throw new Error(`Geçersiz tablo: ${key}`);
    total += rows.length;
    if (total > 300000) throw new Error("Yedekte çok fazla kayıt var.");
    const columns = getTableColumns(BACKUP_TABLES[key] as AnyPgTable);
    output[key] = rows.map(row => {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`${key}: geçersiz satır.`);
      const record = row as Record<string, unknown>;
      if (!record.id || typeof record.id !== "string") throw new Error(`${key}: kayıt kimliği eksik.`);
      const normalized: Record<string, unknown> = {};
      for (const [name, value] of Object.entries(record)) {
        const column = columns[name as keyof typeof columns];
        if (!column) throw new Error(`${key}: bilinmeyen alan ${name}.`);
        if (column.dataType === "date" && value !== null) {
          const date = value instanceof Date ? value : new Date(String(value));
          if (!Number.isFinite(date.getTime())) throw new Error(`${key}: geçersiz tarih.`);
          normalized[name] = date;
        } else normalized[name] = value;
      }
      if (key === "app_settings") {
        if (!record.data || typeof record.data !== "object" || Array.isArray(record.data)) throw new Error("Yedekteki ayarlar geçersiz.");
        normalized.data = validateSettings({ ...DEFAULT_SETTINGS, ...(record.data as Record<string, unknown>) });
      }
      return normalized;
    });
  }
  return output;
}
export async function snapshotAll() {
  return db.transaction(async tx => {
    const data: Record<string, unknown[]> = {}, counts: Record<string, number> = {};
    for (const key of keys) {
      const rows = await tx.select().from(BACKUP_TABLES[key]);
      data[key] = rows; counts[key] = rows.length;
    }
    return { data, counts };
  }, { isolationLevel: "repeatable read" });
}
export async function writeBackup(kind: "AUTO" | "MANUAL" | "SAFETY") {
  const { data, counts } = await snapshotAll();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `personel26_${kind.toLowerCase()}_${stamp}.json`;
  const [created] = await db.insert(dbBackups).values({ filename, kind, recordCounts: counts, data }).returning({ id: dbBackups.id });
  const settings = await getSettings();
  const old = await db.select({ id: dbBackups.id }).from(dbBackups).orderBy(desc(dbBackups.createdAt)).offset(settings.backupRetention);
  if (old.length) await db.delete(dbBackups).where(inArray(dbBackups.id, old.map(row => row.id)));
  await logActivity("BACKUP", `${kind === "AUTO" ? "Otomatik" : kind === "SAFETY" ? "Güvenlik" : "Manuel"} yedek oluşturuldu.`);
  return { id: created.id, filename, counts };
}
let dailyBackup: Promise<unknown> | null = null;
export async function ensureDailyBackup() {
  if (dailyBackup) return dailyBackup;
  dailyBackup = (async () => {
    const settings = await getSettings();
    if (!settings.autoBackup) return { created: false };
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await db.select({ id: dbBackups.id }).from(dbBackups).where(and(eq(dbBackups.kind, "AUTO"), gte(dbBackups.createdAt, since))).limit(1);
    if (recent.length) return { created: false };
    return { created: true, ...await writeBackup("AUTO") };
  })();
  try { return await dailyBackup; } finally { dailyBackup = null; }
}
export async function restoreBackup(input: unknown) {
  const payload = validateBackup(input);
  await writeBackup("SAFETY");
  await db.transaction(async tx => {
    for (const key of DELETE_ORDER) if (payload[key] !== undefined) await tx.delete(BACKUP_TABLES[key]);
    async function insertRows(table: AnyPgTable, rows: Record<string, unknown>[]) {
      for (let i = 0; i < rows.length; i += 100) await tx.insert(table).values(rows.slice(i, i + 100));
    }
    for (const key of keys) if (payload[key]?.length) await insertRows(BACKUP_TABLES[key], payload[key]);
    await tx.insert(activityLogs).values({ action: "RESTORE", description: "Veriler yedekten geri yüklendi. İşlem öncesi güvenlik yedeği saklandı." });
  });
  return { ok: true };
}
function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Geçersiz sayı."); return String(value); }
  const text = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `'${text.replace(/'/g, "''")}'`;
}
export async function exportSql() {
  const { data } = await snapshotAll();
  const lines = ["-- Personel26 veri yedeği. Önce uyumlu schema.sql dosyasını kurun.", "-- UYARI: Bu SQL mevcut uygulama verilerini değiştirir. Önce yedek alın.", "-- Oluşturulma: " + new Date().toISOString(), "BEGIN;", "SET standard_conforming_strings = on;"];
  for (const key of DELETE_ORDER) lines.push(`DELETE FROM public.\"${getTableName(BACKUP_TABLES[key])}\";`);
  for (const key of keys) {
    const columns = getTableColumns(BACKUP_TABLES[key]);
    for (const row of data[key] as Record<string, unknown>[]) {
      const names = Object.keys(row).filter(name => name in columns);
      lines.push(`INSERT INTO public.\"${getTableName(BACKUP_TABLES[key])}\" (${names.map(name => `\"${columns[name as keyof typeof columns].name}\"`).join(", ")}) VALUES (${names.map(name => literal(row[name])).join(", ")});`);
    }
  }
  lines.push("COMMIT;");
  return lines.join("\n");
}
