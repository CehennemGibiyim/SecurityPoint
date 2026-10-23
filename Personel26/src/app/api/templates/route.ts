import { db } from "@/db";
import { shiftTemplates } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(shiftTemplates).orderBy(desc(shiftTemplates.createdAt));
  return Response.json({ templates: rows });
}

export async function POST(req: Request) {
  try {
    const { departmentId, name, slots } = await req.json();
    if (!name?.trim() || !Array.isArray(slots) || !slots.length) {
      return Response.json({ error: "Şablon adı ve en az bir vardiya gerekli" }, { status: 400 });
    }
    const rows = await db.insert(shiftTemplates).values({
      departmentId: departmentId ?? null,
      name: name.trim(),
      shiftCount: slots.length,
      slots,
    }).returning();
    return Response.json({ template: rows[0] });
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
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.slots !== undefined) {
      patch.slots = fields.slots;
      patch.shiftCount = fields.slots.length;
    }
    if (fields.departmentId !== undefined) patch.departmentId = fields.departmentId;
    const rows = await db.update(shiftTemplates).set(patch).where(eq(shiftTemplates.id, id)).returning();
    return Response.json({ template: rows[0] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });
    await db.delete(shiftTemplates).where(eq(shiftTemplates.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}
