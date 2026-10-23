import { db } from "@/db";
import { shiftSchedules, leaveRequests } from "@/db/schema";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { ensureColumns } from "@/lib/server/roster";
import { parseStaffGroup } from "@/lib/shared";

export const dynamic = "force-dynamic";

/** Çizelge ızgarası verisi: sütunlar (güvenceli) + ayın atamaları + onaylı izinler. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const deptId = url.searchParams.get("dept") ?? "";
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));
    if (!deptId || !year || Number.isNaN(month)) {
      return Response.json({ error: "dept, year, month gerekli" }, { status: 400 });
    }
    const dim = new Date(year, month + 1, 0).getDate();
    const startD = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endD = `${year}-${String(month + 1).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;

    const group = parseStaffGroup(url.searchParams.get("group"));
    const columns = await ensureColumns(deptId, year, month, group);
    const colKeys = new Set(columns.map(c => c.key));
    const schedules = (await db.select().from(shiftSchedules).where(and(
      eq(shiftSchedules.departmentId, deptId),
      gte(shiftSchedules.scheduleDate, startD), lte(shiftSchedules.scheduleDate, endD))))
      .filter(s => s.columnKey && colKeys.has(s.columnKey));
    const pids = [...new Set(schedules.map(s => s.personnelId))];
    const param = (url.searchParams.get("personnel") ?? "").split(",").filter(Boolean);
    const leaveIds = param.length ? param : pids;
    const leaves = leaveIds.length
      ? await db.select().from(leaveRequests).where(and(
          inArray(leaveRequests.personnelId, leaveIds),
          eq(leaveRequests.status, "APPROVED"),
          lte(leaveRequests.startDate, endD), gte(leaveRequests.endDate, startD)))
      : [];
    return Response.json({ columns, schedules, approvedLeaves: leaves });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}
