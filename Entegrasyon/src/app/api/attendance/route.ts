import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords, departments, employees, shifts } from "@/db/face-schema";
import { processAccessEvent } from "@/lib/access";
import { ensureSeed } from "@/lib/seed";
import { todayISO } from "@/lib/time";
import type { AccessAction } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSeed();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || todayISO();
  const to = searchParams.get("to") || from;
  const employeeId = searchParams.get("employeeId");

  const filters = [gte(attendanceRecords.workDate, from), lte(attendanceRecords.workDate, to)];
  if (employeeId) filters.push(eq(attendanceRecords.employeeId, Number(employeeId)));

  const rows = await db
    .select({
      attendance: attendanceRecords,
      employee: employees,
      department: departments,
      shift: shifts,
    })
    .from(attendanceRecords)
    .leftJoin(employees, eq(attendanceRecords.employeeId, employees.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(shifts, eq(employees.shiftId, shifts.id))
    .where(and(...filters))
    .orderBy(desc(attendanceRecords.workDate), employees.employeeNo);

  return Response.json({
    from,
    to,
    items: rows.map((row) => ({
      ...row.attendance,
      clockIn: row.attendance.clockIn?.toISOString() ?? null,
      clockOut: row.attendance.clockOut?.toISOString() ?? null,
      employeeName: row.employee
        ? `${row.employee.firstName} ${row.employee.lastName}`
        : "—",
      employeeNo: row.employee?.employeeNo ?? null,
      photoUrl: row.employee?.photoUrl ?? null,
      title: row.employee?.title ?? null,
      departmentName: row.department?.name ?? null,
      departmentColor: row.department?.color ?? null,
      shiftName: row.shift?.name ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    employeeId?: number;
    doorId?: number;
    action?: AccessAction;
    breakType?: "yemek" | "cay" | "namaz" | "sigara" | "diger";
  };
  if (!body.employeeId || !body.doorId) {
    return Response.json({ error: "Personel ve kapı gerekli." }, { status: 400 });
  }
  const result = await processAccessEvent({
    employeeId: body.employeeId,
    doorId: body.doorId,
    action: body.action ?? "auto",
    breakType: body.breakType,
  });
  return Response.json(result);
}
