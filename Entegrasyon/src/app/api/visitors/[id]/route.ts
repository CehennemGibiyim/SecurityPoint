import { eq } from "drizzle-orm";
import { db } from "@/db";
import { visitors } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ensureSeed();
  const { id } = await ctx.params;
  const b = (await req.json()) as { action?: string };
  const now = new Date();
  const [cur] = await db.select().from(visitors).where(eq(visitors.id, Number(id)));
  if (!cur) return Response.json({error:"Bulunamadı"},{status:404});
  if (cur.status === "blacklisted") return Response.json({error:"BLACKLIST: Bu ziyaretçinin girişi yasaklıdır."},{status:403});
  if (now > cur.validTo && b.action === "checkin") return Response.json({error:"QR süresi dolmuş."},{status:410});

  const patch = b.action === "checkin"
    ? { status:"checked_in", checkedInAt: now }
    : b.action === "checkout"
    ? { status:"checked_out", checkedOutAt: now }
    : b.action === "blacklist"
    ? { status:"blacklisted" }
    : null;
  if (!patch) return Response.json({error:"Geçersiz işlem"},{status:400});
  const [updated] = await db.update(visitors).set(patch).where(eq(visitors.id, Number(id))).returning();
  return Response.json({ item: updated });
}
