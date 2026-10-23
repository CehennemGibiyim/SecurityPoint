import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { accessLogs, doors, employees } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";
import { todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSeed();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || todayISO();
  const doorId = searchParams.get("doorId");
  const result = searchParams.get("result");
  const start = new Date(`${date}T00:00:00+03:00`);

  const filters = [gte(accessLogs.createdAt, start)];
  if (doorId) filters.push(eq(accessLogs.doorId, Number(doorId)));
  if (result) filters.push(eq(accessLogs.result, result));

  const rows = await db
    .select({
      log: accessLogs,
      employee: employees,
      door: doors,
    })
    .from(accessLogs)
    .leftJoin(employees, eq(accessLogs.employeeId, employees.id))
    .leftJoin(doors, eq(accessLogs.doorId, doors.id))
    .where(and(...filters))
    .orderBy(desc(accessLogs.createdAt))
    .limit(200);

  return Response.json({
    items: rows.map((row) => ({
      id: row.log.id,
      eventType: row.log.eventType,
      result: row.log.result,
      reason: row.log.reason,
      confidence: row.log.confidence,
      createdAt: row.log.createdAt.toISOString(),
      employeeName: row.employee
        ? `${row.employee.firstName} ${row.employee.lastName}`
        : "Bilinmeyen yüz",
      employeeNo: row.employee?.employeeNo ?? null,
      photoUrl: row.employee?.photoUrl ?? null,
      doorName: row.door?.name ?? "—",
      doorCode: row.door?.code ?? null,
    })),
  });
}
