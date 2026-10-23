import { db } from "@/db";
import { shiftSchedules, leaveRequests } from "@/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { syncTimesheetFromSchedules } from "@/lib/server/core";
import { rangesOverlap, slotByKey } from "@/lib/shared";

export const dynamic = "force-dynamic";

/** Nöbet çizelgesi verisi: dept+ay veya tarih aralığı ile. İzinleri de döner. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const deptId = url.searchParams.get("dept") ?? "";
    let startD = url.searchParams.get("start") ?? "";
    let endD = url.searchParams.get("end") ?? "";
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));
    if (!startD && year && !Number.isNaN(year) && !Number.isNaN(month)) {
      const dim = new Date(year, month + 1, 0).getDate();
      startD = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      endD = `${year}-${String(month + 1).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
    }
    if (!startD || !endD) return Response.json({ error: "Tarih aralığı gerekli" }, { status: 400 });

    const schedules = deptId
      ? await db.select().from(shiftSchedules).where(and(
          eq(shiftSchedules.departmentId, deptId),
          gte(shiftSchedules.scheduleDate, startD), lte(shiftSchedules.scheduleDate, endD)))
      : await db.select().from(shiftSchedules).where(and(
          gte(shiftSchedules.scheduleDate, startD), lte(shiftSchedules.scheduleDate, endD)));

    const pids = [...new Set(schedules.map(s => s.personnelId))];
    const personnelParam = (url.searchParams.get("personnel") ?? "").split(",").filter(Boolean);
    const leaveIds = personnelParam.length ? personnelParam : pids;
    const leaves = leaveIds.length
      ? await db.select().from(leaveRequests).where(and(
          inArray(leaveRequests.personnelId, leaveIds),
          eq(leaveRequests.status, "APPROVED"),
          lte(leaveRequests.startDate, endD), gte(leaveRequests.endDate, startD)))
      : [];
    return Response.json({ schedules, approvedLeaves: leaves });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

async function shiftConflict(personnelId: string, date: string, start: string, end: string, ignoreId?: string) {
  const existing = await db.select().from(shiftSchedules).where(and(
    eq(shiftSchedules.personnelId, personnelId), eq(shiftSchedules.scheduleDate, date)));
  for (const s of existing) {
    if (ignoreId && s.id === ignoreId) continue;
    if (s.startTime && s.endTime && rangesOverlap(start, end, s.startTime, s.endTime)) return s;
  }
  return null;
}

async function onApprovedLeave(personnelId: string, date: string) {
  const rows = await db.select().from(leaveRequests).where(and(
    eq(leaveRequests.personnelId, personnelId), eq(leaveRequests.status, "APPROVED"),
    lte(leaveRequests.startDate, date), gte(leaveRequests.endDate, date)));
  return rows[0] ?? null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { departmentId, scheduleDate, personnelId, shiftSlot } = body;
    if (!departmentId || !scheduleDate || !personnelId) {
      return Response.json({ error: "Eksik alan" }, { status: 400 });
    }
    const preset = slotByKey(shiftSlot);
    const startTime = body.startTime ?? preset?.start ?? "08:00";
    const endTime = body.endTime ?? preset?.end ?? "16:00";

    const leave = await onApprovedLeave(personnelId, scheduleDate);
    if (leave) return Response.json({ error: "Onaylı izinli personel nöbete atanamaz." }, { status: 409 });

    const conflict = await shiftConflict(personnelId, scheduleDate, startTime, endTime);
    if (conflict) {
      return Response.json({
        error: `Çakışma! Bu personelin ${scheduleDate} tarihinde ${conflict.startTime?.slice(0, 5)}–${conflict.endTime?.slice(0, 5)} vardiyası zaten var.`,
      }, { status: 409 });
    }
    const rows = await db.insert(shiftSchedules).values({
      departmentId, scheduleDate, personnelId,
      shiftSlot: shiftSlot ?? "CUSTOM",
      shiftLabel: body.shiftLabel ?? preset?.label ?? shiftSlot ?? null,
      startTime, endTime, notes: body.notes ?? null,
    }).returning();
    await syncTimesheetFromSchedules(personnelId, scheduleDate);
    return Response.json({ schedule: rows[0] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });
    const current = (await db.select().from(shiftSchedules).where(eq(shiftSchedules.id, id)))[0];
    if (!current) return Response.json({ error: "Kayıt bulunamadı" }, { status: 404 });

    if (fields.shiftSlot && !("startTime" in fields) && !("endTime" in fields)) {
      const preset = slotByKey(fields.shiftSlot);
      if (preset && fields.shiftSlot !== "CUSTOM") {
        fields.startTime = preset.start;
        fields.endTime = preset.end;
        fields.shiftLabel = preset.label;
      }
    }
    const pid = fields.personnelId ?? current.personnelId;
    const date = fields.scheduleDate ?? current.scheduleDate;
    const start = fields.startTime ?? current.startTime;
    const end = fields.endTime ?? current.endTime;
    if (start && end) {
      const conflict = await shiftConflict(pid, date, start, end, id);
      if (conflict) {
        return Response.json({
          error: `Çakışma! ${date} tarihinde ${conflict.startTime?.slice(0, 5)}–${conflict.endTime?.slice(0, 5)} vardiyası zaten var.`,
        }, { status: 409 });
      }
    }
    const allowed = ["scheduleDate", "personnelId", "shiftSlot", "shiftLabel", "startTime", "endTime", "notes"];
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of allowed) if (k in fields) patch[k] = fields[k];
    const rows = await db.update(shiftSchedules).set(patch).where(eq(shiftSchedules.id, id)).returning();
    await syncTimesheetFromSchedules(rows[0].personnelId, rows[0].scheduleDate);
    if (current.personnelId !== rows[0].personnelId || current.scheduleDate !== rows[0].scheduleDate) {
      await syncTimesheetFromSchedules(current.personnelId, current.scheduleDate);
    }
    return Response.json({ schedule: rows[0] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });
    const current = (await db.select().from(shiftSchedules).where(eq(shiftSchedules.id, id)))[0];
    await db.delete(shiftSchedules).where(eq(shiftSchedules.id, id));
    if (current) await syncTimesheetFromSchedules(current.personnelId, current.scheduleDate);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Hata" }, { status: 500 });
  }
}
