import { db } from "@/db";
import { timesheetEntries, shiftSchedules, weeklyOverrides, leaveRequests } from "@/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Aylık puantaj verisi: girişler + nöbet kayıtları + haftalık manuel düzeltmeler. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ids = (url.searchParams.get("personnel") ?? "").split(",").filter(x => UUID_RE.test(x));
    const deptId = url.searchParams.get("dept") ?? "";
    if (!ids.length) return Response.json({ entries: [], schedules: [], overrides: [], approvedLeaves: [] });
    const dim = new Date(year, month + 1, 0).getDate();
    const startD = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endD = `${year}-${String(month + 1).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
    const [entries, schedules, overrides, leaves] = await Promise.all([
      db.select().from(timesheetEntries).where(and(inArray(timesheetEntries.personnelId, ids), gte(timesheetEntries.entryDate, startD), lte(timesheetEntries.entryDate, endD))),
      db.select().from(shiftSchedules).where(and(inArray(shiftSchedules.personnelId, ids), gte(shiftSchedules.scheduleDate, startD), lte(shiftSchedules.scheduleDate, endD))),
      deptId
        ? db.select().from(weeklyOverrides).where(and(eq(weeklyOverrides.departmentId, deptId), eq(weeklyOverrides.periodYear, year), eq(weeklyOverrides.periodMonth, month)))
        : Promise.resolve([]),
      db.select().from(leaveRequests).where(and(inArray(leaveRequests.personnelId, ids), eq(leaveRequests.status, "APPROVED"), lte(leaveRequests.startDate, endD), gte(leaveRequests.endDate, startD))),
    ]);
    return Response.json({ entries, schedules, overrides, approvedLeaves: leaves });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

/** Puantaj hücresi kaydetme (kod veya saat). */
export async function PUT(req: Request) {
  try {
    const { personnelId, entryDate, shiftType, hoursWorked } = await req.json();
    if (!personnelId || !entryDate) return Response.json({ error: "Eksik alan" }, { status: 400 });
    const existing = await db.select().from(timesheetEntries).where(and(
      eq(timesheetEntries.personnelId, personnelId), eq(timesheetEntries.entryDate, entryDate)));
    if (existing[0]) {
      const rows = await db.update(timesheetEntries)
        .set({ shiftType: shiftType ?? "MANUAL", hoursWorked: Number(hoursWorked) || 0 })
        .where(eq(timesheetEntries.id, existing[0].id)).returning();
      return Response.json({ entry: rows[0] });
    }
    const rows = await db.insert(timesheetEntries).values({
      personnelId, entryDate, shiftType: shiftType ?? "MANUAL", hoursWorked: Number(hoursWorked) || 0,
    }).returning();
    return Response.json({ entry: rows[0] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

/** Hücre silme. */
export async function DELETE(req: Request) {
  try {
    const { personnelId, entryDate } = await req.json();
    if (!personnelId || !entryDate) return Response.json({ error: "Eksik alan" }, { status: 400 });
    await db.delete(timesheetEntries).where(and(
      eq(timesheetEntries.personnelId, personnelId), eq(timesheetEntries.entryDate, entryDate)));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}
