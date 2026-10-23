import { eq } from "drizzle-orm";
import { db } from "@/db";
import { doorPermissions } from "@/db/face-schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    isActive?: boolean;
    daysOfWeek?: number[];
    startTime?: string;
    endTime?: string;
  };
  const [item] = await db
    .update(doorPermissions)
    .set({
      isActive: body.isActive,
      daysOfWeek: body.daysOfWeek,
      startTime: body.startTime,
      endTime: body.endTime,
    })
    .where(eq(doorPermissions.id, Number(id)))
    .returning();
  return Response.json({ item });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  await db.delete(doorPermissions).where(eq(doorPermissions.id, Number(id)));
  return Response.json({ ok: true });
}
