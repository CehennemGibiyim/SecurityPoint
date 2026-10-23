import { db } from "@/db";
import { appSettings, activityLogs, dbBackups, departments, personnel, schemaVersions } from "@/db/schema";
import { count, desc, eq, sql } from "drizzle-orm";
import { getSettings, requireSameOrigin } from "@/lib/server/settings";
import { validateSettings } from "@/lib/settings";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const [settings, lastBackup, logs, people, services, version, schema] = await Promise.all([
      getSettings(), db.select({ id: dbBackups.id, createdAt: dbBackups.createdAt, kind: dbBackups.kind }).from(dbBackups).orderBy(desc(dbBackups.createdAt)).limit(1),
      db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(8),
      db.select({ total: count() }).from(personnel), db.select({ total: count() }).from(departments),
      db.execute(sql`select current_setting('server_version') as version`),
      db.select().from(schemaVersions).where(eq(schemaVersions.id, "2026-01-settings-import")),
    ]);
    return Response.json({ settings, status: { connected: true, personnel: people[0].total, departments: services[0].total, version: version.rows[0]?.version ?? "PostgreSQL", schemaVersion: schema.length ? "2026.01" : "Güncelleme bekliyor", nodeVersion: typeof process !== "undefined" ? process.versions?.node ?? "PGlite" : "PGlite", lastBackup: lastBackup[0] ?? null, windowsTest: "pending" }, logs });
  } catch {
    return Response.json({ error: "Veritabanına ulaşılamadı. Bağlantıyı ve şemayı kontrol edin." }, { status: 503 });
  }
}
export async function PUT(request: Request) {
  try {
    requireSameOrigin(request);
    const settings = validateSettings(await request.json());
    // Özel nöbet grupları ayrı uç noktadan yönetilir; eski bir ekranın kaydı onları silmesin.
    settings.customGroups = (await getSettings()).customGroups ?? [];
    await db.transaction(async tx => {
      await tx.insert(appSettings).values({ id: "global", data: settings, updatedAt: new Date() }).onConflictDoUpdate({ target: appSettings.id, set: { data: settings, updatedAt: new Date() } });
      await tx.insert(activityLogs).values({ action: "SETTINGS", description: "Kurum bilgileri ve panel tercihleri güncellendi." });
    });
    return Response.json({ settings, savedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Ayarlar kaydedilemedi." }, { status: 400 });
  }
}
