import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords, departments, employees } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";
import { addDaysISO, todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSeed();
  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") || todayISO();
  const from = searchParams.get("from") || addDaysISO(to, -6);
  const departmentId = searchParams.get("departmentId");

  const filters = [
    gte(attendanceRecords.workDate, from),
    lte(attendanceRecords.workDate, to),
  ];

  const rows = await db
    .select({
      attendance: attendanceRecords,
      employee: employees,
      department: departments,
    })
    .from(attendanceRecords)
    .leftJoin(employees, eq(attendanceRecords.employeeId, employees.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(and(...filters));

  const filtered = departmentId
    ? rows.filter((row) => row.employee?.departmentId === Number(departmentId))
    : rows;

  const byEmployee = new Map<
    number,
    {
      employeeId: number;
      employeeNo: string;
      name: string;
      departmentName: string;
      photoUrl: string | null;
      days: number;
      presentDays: number;
      lateDays: number;
      absentDays: number;
      workMinutes: number;
      breakMinutes: number;
      overtimeMinutes: number;
      lateMinutes: number;
    }
  >();

  for (const row of filtered) {
    if (!row.employee) continue;
    const current = byEmployee.get(row.employee.id) ?? {
      employeeId: row.employee.id,
      employeeNo: row.employee.employeeNo,
      name: `${row.employee.firstName} ${row.employee.lastName}`,
      departmentName: row.department?.name ?? "—",
      photoUrl: row.employee.photoUrl,
      days: 0,
      presentDays: 0,
      lateDays: 0,
      absentDays: 0,
      workMinutes: 0,
      breakMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
    };
    current.days += 1;
    current.workMinutes += row.attendance.workMinutes;
    current.breakMinutes += row.attendance.breakMinutes;
    current.overtimeMinutes += row.attendance.overtimeMinutes;
    current.lateMinutes += row.attendance.lateMinutes;
    if (!row.attendance.clockIn) current.absentDays += 1;
    else {
      current.presentDays += 1;
      if (row.attendance.lateMinutes > 0) current.lateDays += 1;
    }
    byEmployee.set(row.employee.id, current);
  }

  const items = [...byEmployee.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const summary = items.reduce(
    (acc, item) => {
      acc.workMinutes += item.workMinutes;
      acc.breakMinutes += item.breakMinutes;
      acc.overtimeMinutes += item.overtimeMinutes;
      acc.lateMinutes += item.lateMinutes;
      acc.absentDays += item.absentDays;
      acc.lateDays += item.lateDays;
      return acc;
    },
    {
      workMinutes: 0,
      breakMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
      absentDays: 0,
      lateDays: 0,
    },
  );

  return Response.json({
    from,
    to,
    items,
    summary,
    details: filtered.map((row) => ({
      ...row.attendance,
      clockIn: row.attendance.clockIn?.toISOString() ?? null,
      clockOut: row.attendance.clockOut?.toISOString() ?? null,
      employeeName: row.employee
        ? `${row.employee.firstName} ${row.employee.lastName}`
        : "—",
      employeeNo: row.employee?.employeeNo ?? null,
      departmentName: row.department?.name ?? null,
    })),
  });
}
