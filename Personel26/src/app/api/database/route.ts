import { db } from "@/db";
import { sql } from "drizzle-orm";
import { exportSql, validateBackup, restoreBackup, writeBackup } from "@/lib/server/backups";
import { SCHEMA_UPDATE_SQL, SCHEMA_VERSION, schemaUpdateStatements } from "@/lib/schema-updates";
import { logActivity, requireSameOrigin } from "@/lib/server/settings";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const format = new URL(request.url).searchParams.get("format");
    const content = format === "schema" ? `-- Personel26 ${SCHEMA_VERSION}, veri silmeyen şema güncellemesi\nBEGIN;\n${SCHEMA_UPDATE_SQL}\nCOMMIT;\n` : await exportSql();
    return new Response(content, { headers: { "Content-Type": "application/sql; charset=utf-8", "Content-Disposition": `attachment; filename="personel26_${format === "schema" ? "schema_update" : "backup"}.sql"` } });
  } catch { return Response.json({ error: "SQL oluşturulamadı." }, { status: 500 }); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const text = await request.text();
    if (text.length > 30 * 1024 * 1024) return Response.json({ error: "Yedek dosyası en fazla 30 MB olabilir." }, { status: 413 });
    const body = JSON.parse(text);
    if (body.action === "update") {
      if (body.confirm !== "GÜNCELLE") throw new Error("Şema güncellemesini onaylayın.");
      await writeBackup("SAFETY");
      await db.transaction(async tx => {
        for (const statement of schemaUpdateStatements()) await tx.execute(sql.raw(statement));
      });
      await logActivity("SCHEMA", `Veri kaybı olmadan şema ${SCHEMA_VERSION} sürümüne güncellendi.`);
      return Response.json({ ok: true, version: SCHEMA_VERSION });
    }
    const payload = validateBackup(body.data);
    if (body.action === "preview") return Response.json({ valid: true, counts: Object.fromEntries(Object.entries(payload).map(([key, rows]) => [key, rows.length])) });
    if (body.action !== "restore" || body.confirm !== "GERİ YÜKLE") throw new Error("Geri yüklemeyi açıkça onaylayın.");
    await restoreBackup(payload);
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Veritabanı işlemi başarısız." }, { status: 400 }); }
}
