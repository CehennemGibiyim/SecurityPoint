import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { breaks, employees } from "@/db/face-schema";
import { recomputeAttendance } from "@/lib/access";
import { ensureSeed } from "@/lib/seed";
import { minutesBetween, todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSeed();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || todayISO();
  const to = searchParams.get("to") || from;
  const start = new Date(`${from}T00:00:00+03:00`);
  const end = new Date(`${to}T23:59:59+03:00`);

  const rows = await db
    .select({
      break: breaks,
      employee: employees,
    })
    .from(breaks)
    .leftJoin(employees, eq(breaks.employeeId, employees.id))
    .where(and(gte(breaks.startedAt, start), lte(breaks.startedAt, end)))
    .orderBy(desc(breaks.startedAt));

  return Response.json({
    items: rows.map((row) => ({
      ...row.break,
      startedAt: row.break.startedAt.toISOString(),
      endedAt: row.break.endedAt ? row.break.endedAt.toISOString() : null,
      liveMinutes: row.break.endedAt
        ? row.break.durationMinutes
        : minutesBetween(row.break.startedAt, new Date()),
      employeeName: row.employee
        ? `${row.employee.firstName} ${row.employee.lastName}`
        : "—",
      employeeNo: row.employee?.employeeNo ?? null,
      photoUrl: row.employee?.photoUrl ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: number; action?: "end" };
  if (body.action === "end" && body.id) {
    const current = await db
      .select()
      .from(breaks)
      .where(eq(breaks.id, body.id))
      .then((rows) => rows[0]);
    if (!current) return Response.json({ error: "Kayıt yok" }, { status: 404 });
    if (current.endedAt) return Response.json({ item: current });
    const now = new Date();
    const duration = minutesBetween(current.startedAt, now);
    const [item] = await db
      .update(breaks)
      .set({ endedAt: now, durationMinutes: duration })
      .where(eq(breaks.id, current.id))
      .returning();
    if (item.attendanceId) await recomputeAttendance(item.attendanceId);
    return Response.json({ item });
  }
  return Response.json({ error: "Geçersiz istek" }, { status: 400 });
}
