import { eq } from "drizzle-orm";
import { db } from "@/db";
import { doorPermissions, doors, employees } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const items = await db
    .select({
      permission: doorPermissions,
      employee: employees,
      door: doors,
    })
    .from(doorPermissions)
    .leftJoin(employees, eq(doorPermissions.employeeId, employees.id))
    .leftJoin(doors, eq(doorPermissions.doorId, doors.id));

  return Response.json({
    items: items.map((row) => ({
      ...row.permission,
      employeeName: row.employee
        ? `${row.employee.firstName} ${row.employee.lastName}`
        : "—",
      employeeNo: row.employee?.employeeNo ?? null,
      photoUrl: row.employee?.photoUrl ?? null,
      doorName: row.door?.name ?? "—",
      doorCode: row.door?.code ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    employeeId?: number;
    doorId?: number;
    daysOfWeek?: number[];
    startTime?: string;
    endTime?: string;
    validFrom?: string | null;
    validTo?: string | null;
  };
  if (!body.employeeId || !body.doorId) {
    return Response.json({ error: "Personel ve kapı seçilmelidir." }, { status: 400 });
  }
  const [item] = await db
    .insert(doorPermissions)
    .values({
      employeeId: body.employeeId,
      doorId: body.doorId,
      daysOfWeek: body.daysOfWeek?.length ? body.daysOfWeek : [1, 2, 3, 4, 5],
      startTime: body.startTime || "00:00",
      endTime: body.endTime || "23:59",
      validFrom: body.validFrom || null,
      validTo: body.validTo || null,
      isActive: true,
    })
    .returning();
  return Response.json({ item }, { status: 201 });
}
