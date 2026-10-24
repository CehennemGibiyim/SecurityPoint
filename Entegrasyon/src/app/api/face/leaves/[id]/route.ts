import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, leaveRequests } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";
import { getSettings } from "@/lib/server/settings";
import { sendLeaveDecisionMail } from "@/lib/server/mailer";

export const dynamic = "force-dynamic";

/** Onay/ret kararından sonra ücretsiz SMTP ile bildirim (ayarlar etkinse). */
async function notifyLeaveDecision(leave: typeof leaveRequests.$inferSelect) {
  try {
    const smtp = (await getSettings()).smtp;
    if (!smtp.enabled || !smtp.host) return;
    const [employee] = await db.select().from(employees).where(eq(employees.id, leave.employeeId)).limit(1);
    await sendLeaveDecisionMail(smtp, {
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : `#${leave.employeeId}`,
      employeeNo: employee?.employeeNo ?? "",
      type: leave.type,
      startDate: leave.startDate,
      endDate: leave.endDate,
      days: leave.days,
      reason: leave.reason ?? "",
      status: leave.status,
      approvedBy: leave.approvedBy ?? "",
    });
  } catch (error) {
    console.warn("[mail] izin bildirimi atlandı:", error instanceof Error ? error.message : String(error));
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ensureSeed();
  const { id } = await ctx.params;
  const b = (await req.json()) as { status?: string; approvedBy?: string };
  if (!["approved","rejected","pending"].includes(b.status ?? "")) return Response.json({error:"Geçersiz durum"},{status:400});
  const [updated] = await db.update(leaveRequests)
    .set({ status: b.status, approvedBy: b.approvedBy?.trim() || "Yönetici" })
    .where(eq(leaveRequests.id, Number(id))).returning();
  if (!updated) return Response.json({error:"Bulunamadı"},{status:404});
  if (updated.status === "approved" || updated.status === "rejected") void notifyLeaveDecision(updated);
  return Response.json({ item: updated });
}
