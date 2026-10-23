import { eq } from "drizzle-orm";
import { db } from "@/db";
import { doorPermissions, doors, employees, shifts } from "@/db/face-schema";
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
    action?: string;
    employeeId?: number;
    doorId?: number;
    daysOfWeek?: number[];
    startTime?: string;
    endTime?: string;
    validFrom?: string | null;
    validTo?: string | null;
  };

  // Vardiyalardan otomatik kapı yetkisi senkronu (Puantaj26 nöbet/vardiya → kapı)
  if (body.action === "sync_shifts") {
    const [emps, shs, drs, existing] = await Promise.all([
      db.select().from(employees),
      db.select().from(shifts),
      db.select().from(doors),
      db.select().from(doorPermissions),
    ]);
    const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
    const auto = existing.filter((p) => p.source === "vardiya");
    const manualPairs = new Set(
      existing.filter((p) => p.source !== "vardiya").map((p) => `${p.employeeId}:${p.doorId}`),
    );
    const activeDoors = drs.filter((d) => d.isActive && d.accessPolicy !== "all");
    const wanted = new Set<string>();
    let created = 0, updated = 0, removed = 0;

    for (const e of emps) {
      if (e.status !== "active" || !e.shiftId) continue;
      const shift = shs.find((s) => s.id === e.shiftId);
      if (!shift) continue;
      for (const d of activeDoors) {
        const key = `${e.id}:${d.id}`;
        wanted.add(key);
        const existingAuto = auto.find((p) => p.employeeId === e.id && p.doorId === d.id);
        if (existingAuto) {
          const same =
            existingAuto.startTime === shift.startTime &&
            existingAuto.endTime === shift.endTime &&
            existingAuto.isActive &&
            !existingAuto.validFrom &&
            !existingAuto.validTo &&
            JSON.stringify(existingAuto.daysOfWeek) === JSON.stringify(ALL_DAYS);
          if (!same) {
            await db.update(doorPermissions).set({
              startTime: shift.startTime, endTime: shift.endTime, daysOfWeek: ALL_DAYS,
              isActive: true, validFrom: null, validTo: null,
            }).where(eq(doorPermissions.id, existingAuto.id));
            updated++;
          }
        } else if (!manualPairs.has(key)) {
          await db.insert(doorPermissions).values({
            employeeId: e.id, doorId: d.id, daysOfWeek: ALL_DAYS,
            startTime: shift.startTime, endTime: shift.endTime, isActive: true, source: "vardiya",
          });
          created++;
        }
      }
    }
    // Vardiyası kalkan / pasifleşen personelin vardiya kaynaklı yetkileri düşer
    for (const p of auto) {
      if (!wanted.has(`${p.employeeId}:${p.doorId}`)) {
        await db.delete(doorPermissions).where(eq(doorPermissions.id, p.id));
        removed++;
      }
    }
    return Response.json({ ok: true, created, updated, removed, doors: activeDoors.length });
  }

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
