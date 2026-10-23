import { db } from "@/db";
import { dbBackups } from "@/db/schema";
import { eq } from "drizzle-orm";
import { restoreBackup } from "@/lib/server/core";
import { requireSameOrigin } from "@/lib/server/settings";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!uuid.test(id)) return Response.json({ error: "Yedek bulunamadı." }, { status: 404 });
  const row = (await db.select().from(dbBackups).where(eq(dbBackups.id, id)))[0];
  if (!row) return Response.json({ error: "Yedek bulunamadı." }, { status: 404 });
  return new Response(JSON.stringify(row.data, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${row.filename}"` } });
}
export async function POST(request: Request, { params }: Params) {
  try {
    requireSameOrigin(request);
    const body = await request.json().catch(() => null);
    if (body?.confirm !== "GERİ YÜKLE") return Response.json({ error: "Geri yükleme açık onay gerektirir." }, { status: 400 });
    const { id } = await params;
    if (!uuid.test(id)) return Response.json({ error: "Yedek bulunamadı." }, { status: 404 });
    const row = (await db.select().from(dbBackups).where(eq(dbBackups.id, id)))[0];
    if (!row?.data) return Response.json({ error: "Yedek bulunamadı." }, { status: 404 });
    await restoreBackup(row.data);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Geri yükleme başarısız. Mevcut veriler korundu; güvenlik yedeğinizi kontrol edin." }, { status: 400 });
  }
}
