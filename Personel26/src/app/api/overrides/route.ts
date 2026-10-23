import { db } from "@/db";
import { weeklyOverrides } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Haftalık çalışılan/gece/fazla/bayram manuel düzeltmesi (upsert). */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { departmentId, personnelId, periodYear, periodMonth, weekIndex, worked, night, extra, holiday } = body;
    if (!departmentId || !personnelId) return Response.json({ error: "Eksik alan" }, { status: 400 });
    const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
    const existing = await db.select().from(weeklyOverrides).where(and(
      eq(weeklyOverrides.personnelId, personnelId),
      eq(weeklyOverrides.periodYear, periodYear),
      eq(weeklyOverrides.periodMonth, periodMonth),
      eq(weeklyOverrides.weekIndex, weekIndex),
    ));
    const payload = { worked: num(worked), night: num(night), extra: num(extra), holiday: num(holiday) };
    if (existing[0]) {
      const rows = await db.update(weeklyOverrides).set(payload).where(eq(weeklyOverrides.id, existing[0].id)).returning();
      return Response.json({ override: rows[0] });
    }
    const rows = await db.insert(weeklyOverrides).values({
      departmentId, personnelId, periodYear, periodMonth, weekIndex, ...payload,
    }).returning();
    return Response.json({ override: rows[0] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}
