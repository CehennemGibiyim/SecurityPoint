import { db } from "@/db";
import { shiftSwapRequests, shiftSchedules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { syncTimesheetFromSchedules } from "@/lib/server/core";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(shiftSwapRequests);
  rows.sort((a, b) => (b.createdAt?.toString() ?? "").localeCompare(a.createdAt?.toString() ?? ""));
  return Response.json({ swaps: rows });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { requesterId, requesterShiftId, targetPersonnelId, targetShiftId, swapDate, reason } = body;
    if (!requesterId || !swapDate) return Response.json({ error: "Eksik alan" }, { status: 400 });
    const rows = await db.insert(shiftSwapRequests).values({
      requesterId, requesterShiftId: requesterShiftId || null,
      targetPersonnelId: targetPersonnelId || null, targetShiftId: targetShiftId || null,
      swapDate, reason: reason ?? null, status: "PENDING",
    }).returning();
    return Response.json({ swap: rows[0] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

/** Onaylama: iki vardiya seçildiyse takas, yalnız hedef kişi varsa devir. */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, action, by } = body;
    const current = (await db.select().from(shiftSwapRequests).where(eq(shiftSwapRequests.id, id)))[0];
    if (!current) return Response.json({ error: "Kayıt bulunamadı" }, { status: 404 });
    const now = new Date();

    if (action === "approve") {
      const touched: Array<[string, string]> = [];
      if (current.requesterShiftId && current.targetShiftId) {
        const a = (await db.select().from(shiftSchedules).where(eq(shiftSchedules.id, current.requesterShiftId)))[0];
        const b = (await db.select().from(shiftSchedules).where(eq(shiftSchedules.id, current.targetShiftId)))[0];
        if (a && b) {
          await db.update(shiftSchedules).set({ personnelId: b.personnelId, updatedAt: now }).where(eq(shiftSchedules.id, a.id));
          await db.update(shiftSchedules).set({ personnelId: a.personnelId, updatedAt: now }).where(eq(shiftSchedules.id, b.id));
          touched.push([a.personnelId, a.scheduleDate], [b.personnelId, b.scheduleDate]);
        }
      } else if (current.requesterShiftId && current.targetPersonnelId) {
        const a = (await db.select().from(shiftSchedules).where(eq(shiftSchedules.id, current.requesterShiftId)))[0];
        if (a) {
          touched.push([a.personnelId, a.scheduleDate]);
          await db.update(shiftSchedules).set({ personnelId: current.targetPersonnelId, updatedAt: now }).where(eq(shiftSchedules.id, a.id));
          touched.push([current.targetPersonnelId, a.scheduleDate]);
        }
      }
      const uniq = new Map(touched.map(t => [`${t[0]}|${t[1]}`, t]));
      for (const [pid, dt] of uniq.values()) await syncTimesheetFromSchedules(pid, dt);
      const rows = await db.update(shiftSwapRequests).set({
        status: "APPROVED", decidedBy: by ?? null, decidedAt: now,
      }).where(eq(shiftSwapRequests.id, id)).returning();
      return Response.json({ swap: rows[0] });
    }

    if (action === "reject" || action === "cancel") {
      const rows = await db.update(shiftSwapRequests).set({
        status: action === "reject" ? "REJECTED" : "CANCELLED", decidedBy: by ?? null, decidedAt: now,
      }).where(eq(shiftSwapRequests.id, id)).returning();
      return Response.json({ swap: rows[0] });
    }
    return Response.json({ error: "Geçersiz aksiyon" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });
    await db.delete(shiftSwapRequests).where(eq(shiftSwapRequests.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}
