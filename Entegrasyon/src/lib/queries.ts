import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceRecords,
  breaks,
  departments,
  doors,
  employees,
  shifts,
} from "@/db/face-schema";
import { publicEmployee } from "@/lib/serialize";

export async function listEmployeesDetailed() {
  const rows = await db
    .select({
      employee: employees,
      department: departments,
      shift: shifts,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(shifts, eq(employees.shiftId, shifts.id))
    .orderBy(employees.employeeNo);

  return rows.map((row) =>
    publicEmployee(row.employee, {
      departmentName: row.department?.name ?? null,
      departmentColor: row.department?.color ?? null,
      shiftName: row.shift?.name ?? null,
      shiftStart: row.shift?.startTime ?? null,
      shiftEnd: row.shift?.endTime ?? null,
    }),
  );
}

export async function getEmployeeDetailed(id: number) {
  const row = await db
    .select({
      employee: employees,
      department: departments,
      shift: shifts,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(shifts, eq(employees.shiftId, shifts.id))
    .where(eq(employees.id, id))
    .then((items) => items[0] ?? null);

  if (!row) return null;
  return publicEmployee(row.employee, {
    departmentName: row.department?.name ?? null,
    departmentColor: row.department?.color ?? null,
    shiftName: row.shift?.name ?? null,
    shiftStart: row.shift?.startTime ?? null,
    shiftEnd: row.shift?.endTime ?? null,
  });
}

export async function listDoors() {
  return db.select().from(doors).orderBy(doors.id);
}

export async function todayAttendanceMap(workDate: string) {
  const rows = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.workDate, workDate));
  return new Map(rows.map((row) => [row.employeeId, row]));
}

export async function openBreaksMap() {
  const rows = await db.select().from(breaks);
  const open = rows.filter((row) => !row.endedAt);
  return new Map(open.map((row) => [row.employeeId, row]));
}

export async function recentAttendance(employeeId: number, limit = 14) {
  return db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.employeeId, employeeId))
    .orderBy(desc(attendanceRecords.workDate))
    .limit(limit);
}
