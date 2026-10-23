import { db } from "@/db";
import { dbBackups } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
import { writeBackup } from "@/lib/server/core";

export const dynamic = "force-dynamic";

/** Yedek listesi (veri hariç). */
export async function GET() {
  const rows = await db.select({
    id: dbBackups.id, filename: dbBackups.filename, kind: dbBackups.kind,
    recordCounts: dbBackups.recordCounts, createdAt: dbBackups.createdAt,
  }).from(dbBackups).orderBy(desc(dbBackups.createdAt));
  return Response.json({ backups: rows });
}

/** Elle yedek al. */
export async function POST() {
  try {
    const res = await writeBackup("MANUAL");
    return Response.json(res);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Yedek alınamadı" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || !ids.length) return Response.json({ error: "ids gerekli" }, { status: 400 });
    await db.delete(dbBackups).where(inArray(dbBackups.id, ids));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}
