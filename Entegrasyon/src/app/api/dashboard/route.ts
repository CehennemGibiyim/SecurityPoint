import { desc, gte } from "drizzle-orm";
import { db } from "@/db";
import { accessLogs, doors } from "@/db/face-schema";
import { listEmployeesDetailed, openBreaksMap, todayAttendanceMap } from "@/lib/queries";
import { ensureSeed } from "@/lib/seed";
import { formatMinutes, minutesBetween, todayISO } from "@/lib/time";
import type { PresenceStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const today = todayISO();
  const people = await listEmployeesDetailed();
  const attendance = await todayAttendanceMap(today);
  const openBreaks = await openBreaksMap();
  const doorRows = await db.select().from(doors);
  const now = new Date();

  const presence = people.map((person) => {
    const rec = attendance.get(person.id);
    const brk = openBreaks.get(person.id);
    let presenceStatus: PresenceStatus = "absent";
    if (person.status !== "active") presenceStatus = "inactive";
    else if (rec?.clockOut) presenceStatus = "left";
    else if (brk) presenceStatus = "break";
    else if (rec?.clockIn) presenceStatus = "present";

    const workSoFar =
      rec?.clockIn && !rec.clockOut
        ? Math.max(
            0,
            minutesBetween(rec.clockIn, now) - (rec.breakMinutes ?? 0) - (brk ? minutesBetween(brk.startedAt, now) : 0),
          )
        : (rec?.workMinutes ?? 0);

    return {
      ...person,
      presenceStatus,
      clockIn: rec?.clockIn ? rec.clockIn.toISOString() : null,
      clockOut: rec?.clockOut ? rec.clockOut.toISOString() : null,
      lateMinutes: rec?.lateMinutes ?? 0,
      breakMinutes: rec?.breakMinutes ?? 0,
      workMinutes: rec?.workMinutes ?? workSoFar,
      workLabel: formatMinutes(rec?.clockOut ? rec.workMinutes : workSoFar),
      attendanceStatus: rec?.status ?? "absent",
      openBreakType: brk?.type ?? null,
      openBreakSince: brk?.startedAt ? brk.startedAt.toISOString() : null,
    };
  });

  const active = presence.filter((p) => p.status === "active");
  const present = active.filter((p) => p.presenceStatus === "present").length;
  const onBreak = active.filter((p) => p.presenceStatus === "break").length;
  const left = active.filter((p) => p.presenceStatus === "left").length;
  const absent = active.filter((p) => p.presenceStatus === "absent").length;
  const late = active.filter((p) => (p.lateMinutes ?? 0) > 0 && p.presenceStatus !== "absent").length;
  const enrolledFaces = people.filter((p) => p.hasFace).length;

  const startOfDay = new Date(`${today}T00:00:00+03:00`);
  const logs = await db
    .select()
    .from(accessLogs)
    .where(gte(accessLogs.createdAt, startOfDay))
    .orderBy(desc(accessLogs.createdAt))
    .limit(25);

  const peopleById = new Map(people.map((p) => [p.id, p]));
  const doorsById = new Map(doorRows.map((d) => [d.id, d]));

  const deniedToday = logs.filter((log) => log.result === "denied").length;

  return Response.json({
    today,
    now: now.toISOString(),
    stats: {
      totalEmployees: active.length,
      present,
      onBreak,
      left,
      absent,
      late,
      enrolledFaces,
      deniedToday,
      doors: doorRows.length,
    },
    presence,
    doors: doorRows,
    recentLogs: logs.map((log) => {
      const person = log.employeeId ? peopleById.get(log.employeeId) : null;
      const door = log.doorId ? doorsById.get(log.doorId) : null;
      return {
        id: log.id,
        eventType: log.eventType,
        result: log.result,
        reason: log.reason,
        confidence: log.confidence,
        createdAt: log.createdAt.toISOString(),
        employeeName: person ? `${person.firstName} ${person.lastName}` : "Bilinmeyen yüz",
        employeeNo: person?.employeeNo ?? null,
        photoUrl: person?.photoUrl ?? null,
        doorName: door?.name ?? "—",
      };
    }),
  });
}
