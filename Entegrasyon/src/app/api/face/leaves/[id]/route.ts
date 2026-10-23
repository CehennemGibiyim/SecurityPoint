import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leaveRequests } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ensureSeed();
  const { id } = await ctx.params;
  const b = (await req.json()) as { status?: string; approvedBy?: string };
  if (!["approved","rejected","pending"].includes(b.status ?? "")) return Response.json({error:"Geçersiz durum"},{status:400});
  const [updated] = await db.update(leaveRequests)
    .set({ status: b.status, approvedBy: b.approvedBy?.trim() || "Yönetici" })
    .where(eq(leaveRequests.id, Number(id))).returning();
  if (!updated) return Response.json({error:"Bulunamadı"},{status:404});
  return Response.json({ item: updated });
}
