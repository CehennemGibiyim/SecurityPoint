import { eq } from "drizzle-orm";
import { db } from "@/db";
import { doors } from "@/db/face-schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const doorId = Number(id);
  const existing = await db
    .select()
    .from(doors)
    .where(eq(doors.id, doorId))
    .then((rows) => rows[0]);
  if (!existing) return Response.json({ error: "Kapı bulunamadı." }, { status: 404 });

  const body = (await request.json()) as Record<string, unknown>;
  const [item] = await db
    .update(doors)
    .set({
      name: typeof body.name === "string" ? body.name : existing.name,
      code: typeof body.code === "string" ? body.code : existing.code,
      location: typeof body.location === "string" ? body.location : existing.location,
      type:
        body.type === "entry" || body.type === "exit" || body.type === "both"
          ? body.type
          : existing.type,
      accessPolicy:
        body.accessPolicy === "all" || body.accessPolicy === "permission"
          ? body.accessPolicy
          : existing.accessPolicy,
      isActive: typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
      isLocked: typeof body.isLocked === "boolean" ? body.isLocked : existing.isLocked,
      description:
        typeof body.description === "string" ? body.description : existing.description,
    })
    .where(eq(doors.id, doorId))
    .returning();

  return Response.json({ item });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  await db.delete(doors).where(eq(doors.id, Number(id)));
  return Response.json({ ok: true });
}
