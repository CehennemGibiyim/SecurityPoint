import { db } from "@/db";
import { announcements } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(announcements).orderBy(desc(announcements.createdAt));
  return Response.json({ announcements: rows });
}

export async function POST(req: Request) {
  try {
    const { departmentId, title, body, kind, createdBy } = await req.json();
    if (!title?.trim() || !body?.trim()) return Response.json({ error: "Başlık ve içerik gerekli" }, { status: 400 });
    const rows = await db.insert(announcements).values({
      departmentId: departmentId || null,
      title: title.trim(), body: body.trim(),
      kind: ["INFO", "WARNING", "URGENT"].includes(kind) ? kind : "INFO",
      createdBy: createdBy ?? null,
    }).returning();
    return Response.json({ announcement: rows[0] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    for (const k of ["title", "body", "kind", "departmentId"]) if (k in fields) patch[k] = fields[k];
    const rows = await db.update(announcements).set(patch).where(eq(announcements.id, id)).returning();
    return Response.json({ announcement: rows[0] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });
    await db.delete(announcements).where(eq(announcements.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}
