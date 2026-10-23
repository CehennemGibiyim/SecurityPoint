import { db } from "@/db";
import { leaveRequests } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { applyLeaveToTimesheet, removeLeaveFromTimesheet } from "@/lib/server/core";
import { daysBetween, nextStage } from "@/lib/shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ids = (url.searchParams.get("personnel") ?? "").split(",").filter(Boolean);
    const rows = ids.length
      ? await db.select().from(leaveRequests).where(inArray(leaveRequests.personnelId, ids))
      : await db.select().from(leaveRequests);
    rows.sort((a, b) => (b.createdAt?.toString() ?? "").localeCompare(a.createdAt?.toString() ?? ""));
    return Response.json({ leaves: rows });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { personnelId, leaveType, startDate, endDate, reason } = body;
    if (!personnelId || !leaveType || !startDate || !endDate) {
      return Response.json({ error: "Eksik alan" }, { status: 400 });
    }
    if (endDate < startDate) return Response.json({ error: "Bitiş tarihi başlangıçtan önce olamaz" }, { status: 400 });
    const rows = await db.insert(leaveRequests).values({
      personnelId, leaveType, startDate, endDate,
      daysCount: daysBetween(startDate, endDate),
      reason: reason ?? null, status: "PENDING", approvalStage: "HEMSIRE",
      requestedBy: body.requestedBy ?? null,
    }).returning();
    return Response.json({ leave: rows[0] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

/** Onay akışı: HEMSIRE → MUDUR → BASHEKIM → DONE; red veya iptal. */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, action, by, note } = body;
    const current = (await db.select().from(leaveRequests).where(eq(leaveRequests.id, id)))[0];
    if (!current) return Response.json({ error: "Kayıt bulunamadı" }, { status: 404 });

    const now = new Date();
    if (action === "approve-stage") {
      const stage = current.approvalStage || "HEMSIRE";
      const patch: Record<string, unknown> = { updatedStage: true };
      if (stage === "HEMSIRE") { patch.stageHemsireBy = by ?? null; patch.stageHemsireAt = now; }
      else if (stage === "MUDUR") { patch.stageMudurBy = by ?? null; patch.stageMudurAt = now; }
      else if (stage === "BASHEKIM") { patch.stageBashekimBy = by ?? null; patch.stageBashekimAt = now; }
      const next = nextStage(stage);
      patch.approvalStage = next;
      if (next === "DONE") {
        patch.status = "APPROVED";
        patch.decidedBy = by ?? null;
        patch.decidedAt = now;
      }
      delete patch.updatedStage;
      const rows = await db.update(leaveRequests).set(patch).where(eq(leaveRequests.id, id)).returning();
      if (rows[0].status === "APPROVED") {
        await applyLeaveToTimesheet(rows[0]);
      }
      return Response.json({ leave: rows[0] });
    }

    if (action === "reject") {
      const wasApproved = current.status === "APPROVED";
      const rows = await db.update(leaveRequests).set({
        status: "REJECTED", decidedBy: by ?? null, decidedAt: now, decisionNote: note ?? null,
      }).where(eq(leaveRequests.id, id)).returning();
      if (wasApproved) await removeLeaveFromTimesheet(current);
      return Response.json({ leave: rows[0] });
    }

    if (action === "cancel") {
      const wasApproved = current.status === "APPROVED";
      const rows = await db.update(leaveRequests).set({
        status: "CANCELLED", decidedBy: by ?? null, decidedAt: now,
      }).where(eq(leaveRequests.id, id)).returning();
      if (wasApproved) await removeLeaveFromTimesheet(current);
      return Response.json({ leave: rows[0] });
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
    const current = (await db.select().from(leaveRequests).where(eq(leaveRequests.id, id)))[0];
    await db.delete(leaveRequests).where(eq(leaveRequests.id, id));
    if (current?.status === "APPROVED") await removeLeaveFromTimesheet(current);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}
