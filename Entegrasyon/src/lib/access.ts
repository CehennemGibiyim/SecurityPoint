import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  accessLogs,
  attendanceRecords,
  breaks,
  doorPermissions,
  doors,
  employees,
  leaveRequests,
  securityAlarms,
  shifts,
} from "@/db/face-schema";
import {
  confidenceFromDistance,
  euclidean,
  isValidDescriptor,
  MATCH_THRESHOLD,
} from "@/lib/face-match";
import { publicEmployee, fullName } from "@/lib/serialize";
import {
  greeting,
  isoWeekday,
  minutesBetween,
  shiftWindow,
  timeHHmm,
  todayISO,
} from "@/lib/time";
import type { AccessAction, AccessResponse, BreakType, EmployeePublic } from "@/lib/types";

const COOLDOWN_MS = 7000;
const lastScan = new Map<string, number>();

export type AccessRequest = {
  doorId: number;
  action?: AccessAction;
  descriptor?: number[];
  employeeNo?: string;
  employeeId?: number;
  snapshot?: string | null;
  breakType?: BreakType;
  livenessScore?: number;
  isSpoof?: boolean;
  cardNo?: string;
  qrToken?: string;
  pinCode?: string;
  authMethod?: string;
};

function fail(
  reason: string,
  extra?: Partial<AccessResponse>,
): AccessResponse {
  return {
    ok: false,
    result: extra?.result ?? "denied",
    eventType: extra?.eventType ?? "denied",
    reason,
    message: reason,
    doorUnlocked: false,
    confidence: extra?.confidence ?? null,
    matchDistance: extra?.matchDistance ?? null,
    employee: extra?.employee ?? null,
    door: extra?.door ?? null,
    attendance: extra?.attendance ?? null,
    at: new Date().toISOString(),
  };
}

async function writeLog(input: {
  employeeId?: number | null;
  doorId?: number | null;
  eventType: string;
  result: string;
  reason?: string;
  confidence?: number | null;
  livenessScore?: number | null;
  snapshot?: string | null;
}) {
  await db.insert(accessLogs).values({
    employeeId: input.employeeId ?? null,
    doorId: input.doorId ?? null,
    eventType: input.eventType,
    result: input.result,
    reason: input.reason ?? null,
    confidence: input.confidence ?? null,
    livenessScore: input.livenessScore ?? null,
    snapshot: input.snapshot ?? null,
  });
}

function normalizeSicil(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

async function identifyEmployee(input: AccessRequest) {
  if (isValidDescriptor(input.descriptor)) {
    const enrolled = await db.select().from(employees);
    let best: (typeof enrolled)[number] | null = null;
    let bestDist = Infinity;
    for (const row of enrolled) {
      if (!isValidDescriptor(row.faceDescriptor)) continue;
      const dist = euclidean(input.descriptor, row.faceDescriptor);
      if (dist < bestDist) {
        bestDist = dist;
        best = row;
      }
    }
    if (!best || bestDist > MATCH_THRESHOLD) {
      return {
        employee: null,
        confidence: best ? confidenceFromDistance(bestDist) : 0,
        matchDistance: Number.isFinite(bestDist) ? bestDist : null,
        unknownFace: true,
      };
    }
    return {
      employee: best,
      confidence: confidenceFromDistance(bestDist),
      matchDistance: bestDist,
      unknownFace: false,
    };
  }

  if (input.employeeId) {
    const row = await db
      .select()
      .from(employees)
      .where(eq(employees.id, input.employeeId))
      .then((rows) => rows[0] ?? null);
    return {
      employee: row,
      confidence: 1,
      matchDistance: null,
      unknownFace: false,
    };
  }
  // Alternatif kimlik: RFID kart / QR / PIN (KVKK alternatifi)
  if (input.cardNo || input.qrToken || input.pinCode) {
    const rows = await db.select().from(employees);
    const row =
      (input.cardNo ? rows.find((r) => r.cardNo && r.cardNo === input.cardNo) : undefined) ??
      (input.qrToken ? rows.find((r) => r.qrToken && r.qrToken === input.qrToken) : undefined) ??
      (input.pinCode && input.employeeNo ? rows.find((r) => r.pinCode === input.pinCode && normalizeSicil(r.employeeNo) === normalizeSicil(input.employeeNo!)) : undefined) ??
      (input.pinCode ? rows.find((r) => r.pinCode && r.pinCode === input.pinCode) : undefined) ??
      null;
    return { employee: row, confidence: row ? 1 : 0, matchDistance: null, unknownFace: false };
  }

  if (input.employeeNo) {
    const needle = normalizeSicil(input.employeeNo);
    const digits = needle.replace(/\D/g, "");
    const rows = await db.select().from(employees);
    const row =
      rows.find((item) => normalizeSicil(item.employeeNo) === needle) ??
      rows.find((item) => normalizeSicil(item.employeeNo).endsWith(needle)) ??
      rows.find(
        (item) => digits.length >= 3 && item.employeeNo.replace(/\D/g, "") === digits,
      ) ??
      null;
    return {
      employee: row,
      confidence: row ? 1 : 0,
      matchDistance: null,
      unknownFace: false,
    };
  }

  return { employee: null, confidence: 0, matchDistance: null, unknownFace: false };
}

async function checkDoorPermission(
  employeeId: number,
  door: typeof doors.$inferSelect,
  now: Date,
) {
  if (!door.isActive) {
    return { ok: false, reason: "Bu kapı şu anda devre dışı." };
  }

  if (door.accessPolicy === "all") {
    return { ok: true, reason: "Genel erişim" };
  }

  const perms = await db
    .select()
    .from(doorPermissions)
    .where(
      and(
        eq(doorPermissions.employeeId, employeeId),
        eq(doorPermissions.doorId, door.id),
        eq(doorPermissions.isActive, true),
      ),
    );

  if (perms.length === 0) {
    return { ok: false, reason: "Bu kapıya tanımlı yetkiniz yok." };
  }

  const today = todayISO(now);
  const weekday = isoWeekday(now);
  const clock = timeHHmm(now);

  for (const perm of perms) {
    if (perm.validFrom && today < perm.validFrom) continue;
    if (perm.validTo && today > perm.validTo) continue;
    if (!perm.daysOfWeek.includes(weekday)) continue;
    const overnight = perm.endTime < perm.startTime;
    const inWindow = overnight
      ? clock >= perm.startTime || clock <= perm.endTime
      : clock >= perm.startTime && clock <= perm.endTime;
    if (inWindow) return { ok: true, reason: "Yetki doğrulandı" };
  }

  return { ok: false, reason: "Yetkiniz bugün / bu saatte geçerli değil." };
}

async function getOrCreateAttendance(employeeId: number, workDate: string) {
  const existing = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, employeeId),
        eq(attendanceRecords.workDate, workDate),
      ),
    )
    .then((rows) => rows[0] ?? null);

  if (existing) return existing;

  const created = await db
    .insert(attendanceRecords)
    .values({
      employeeId,
      workDate,
      status: "absent",
    })
    .returning()
    .then((rows) => rows[0]);

  return created;
}

async function openBreakFor(employeeId: number) {
  return db
    .select()
    .from(breaks)
    .where(and(eq(breaks.employeeId, employeeId), isNull(breaks.endedAt)))
    .orderBy(desc(breaks.startedAt))
    .then((rows) => rows[0] ?? null);
}

function attendancePayload(row: typeof attendanceRecords.$inferSelect) {
  return {
    workDate: row.workDate,
    clockIn: row.clockIn ? row.clockIn.toISOString() : null,
    clockOut: row.clockOut ? row.clockOut.toISOString() : null,
    status: row.status,
    breakMinutes: row.breakMinutes,
  };
}

export async function recomputeAttendance(attendanceId: number) {
  const record = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.id, attendanceId))
    .then((rows) => rows[0] ?? null);
  if (!record) return null;

  const employee = await db
    .select()
    .from(employees)
    .where(eq(employees.id, record.employeeId))
    .then((rows) => rows[0] ?? null);

  const shift = employee?.shiftId
    ? await db
        .select()
        .from(shifts)
        .where(eq(shifts.id, employee.shiftId))
        .then((rows) => rows[0] ?? null)
    : null;

  const relatedBreaks = await db
    .select()
    .from(breaks)
    .where(eq(breaks.attendanceId, record.id));

  const now = new Date();
  const breakMinutes = relatedBreaks.reduce((sum, item) => {
    if (item.endedAt) return sum + item.durationMinutes;
    return sum + minutesBetween(item.startedAt, now);
  }, 0);

  let lateMinutes = record.lateMinutes;
  let status = record.status;

  if (record.clockIn && shift) {
    const window = shiftWindow(record.workDate, shift.startTime, shift.endTime);
    const rawLate = minutesBetween(window.start, record.clockIn);
    lateMinutes = rawLate > shift.lateToleranceMinutes ? rawLate : 0;
  }

  let workMinutes = 0;
  let overtimeMinutes = 0;
  if (record.clockIn) {
    const end = record.clockOut ?? now;
    workMinutes = Math.max(0, minutesBetween(record.clockIn, end) - breakMinutes);
    if (shift) {
      const window = shiftWindow(record.workDate, shift.startTime, shift.endTime);
      if (end > window.end) {
        overtimeMinutes = minutesBetween(window.end, end);
      }
    }
  }

  if (!record.clockIn) status = "absent";
  else if (record.clockOut) status = lateMinutes > 0 ? "late" : "present";
  else status = lateMinutes > 0 ? "late" : "present";

  const [updated] = await db
    .update(attendanceRecords)
    .set({
      breakMinutes,
      workMinutes,
      overtimeMinutes,
      lateMinutes,
      status,
    })
    .where(eq(attendanceRecords.id, record.id))
    .returning();

  return updated;
}

function resolveAutoAction(input: {
  action: AccessAction;
  doorType: string;
  hasClockIn: boolean;
  hasClockOut: boolean;
  onBreak: boolean;
}): AccessAction {
  if (input.action !== "auto") return input.action;
  if (input.onBreak) return "break_end";
  if (!input.hasClockIn) return "clock_in";
  if (input.hasClockOut) return "door_only";
  if (input.doorType === "exit") return "clock_out";
  if (input.doorType === "entry") return "door_only";
  return "door_only";
}

export async function processAccessEvent(input: AccessRequest): Promise<AccessResponse> {
  const action: AccessAction = input.action ?? "auto";
  const now = new Date();
  const today = todayISO(now);

  const door = await db
    .select()
    .from(doors)
    .where(eq(doors.id, input.doorId))
    .then((rows) => rows[0] ?? null);

  if (!door) return fail("Kapı kaydı bulunamadı.");

  const doorInfo = {
    id: door.id,
    name: door.name,
    code: door.code,
    location: door.location,
    type: door.type,
  };

  // Anti-Spoofing & Liveness verification check
  if (input.isSpoof) {
    const reason = "Sahtecilik engellendi: 2D Fotoğraf veya ekran tespit edildi (Canlılık testi başarısız).";
    await writeLog({
      doorId: door.id,
      eventType: "spoof_alarm",
      result: "denied",
      reason,
      confidence: 0,
      livenessScore: input.livenessScore ?? 10,
      snapshot: input.snapshot,
    });
    return fail(reason, {
      door: doorInfo,
      result: "denied",
      eventType: "spoof_alarm",
      livenessScore: input.livenessScore ?? 10,
      isSpoof: true,
    });
  }

  const identified = await identifyEmployee(input);
  if (!identified.employee) {
    const reason = identified.unknownFace
      ? "Yüz kaydı eşleşmedi. Sicil ile deneyin veya İK’ya yüz kaydı yaptırın."
      : "Personel bulunamadı.";
    await writeLog({
      doorId: door.id,
      eventType: action,
      result: "denied",
      reason,
      confidence: identified.confidence,
      snapshot: input.snapshot,
    });
    return fail(reason, {
      door: doorInfo,
      confidence: identified.confidence,
      matchDistance: identified.matchDistance,
      eventType: action,
    });
  }

  const employee = identified.employee;
  const person = publicEmployee(employee);
  const name = fullName(employee);

  if (employee.status !== "active") {
    await writeLog({
      employeeId: employee.id,
      doorId: door.id,
      eventType: action,
      result: "denied",
      reason: "Personel kaydı pasif",
      confidence: identified.confidence,
      snapshot: input.snapshot,
    });
    return fail("Personel kaydı pasif. Giriş izni yok.", {
      employee: person,
      door: doorInfo,
      confidence: identified.confidence,
      matchDistance: identified.matchDistance,
    });
  }
  // Blacklist
  if (employee.isBlacklisted) {
    await db.insert(securityAlarms).values({ type: "blacklist", severity: "high", employeeId: employee.id, doorId: door.id, message: `${name} blacklist nedeniyle engellendi: ${employee.blacklistReason ?? "güvenlik"}` }).catch(() => {});
    await writeLog({ employeeId: employee.id, doorId: door.id, eventType: action, result: "denied", reason: "BLACKLIST engeli", confidence: identified.confidence, snapshot: input.snapshot });
    return fail("Güvenlik blacklist kaydı nedeniyle geçiş yasaklı. Güvenlikle görüşün.", { employee: person, door: doorInfo, confidence: identified.confidence, matchDistance: identified.matchDistance, eventType: "blacklist_denied" });
  }
  // Onaylı izin günü uyarısı (girişi engelleme, sadece not)
  const onLeave = await db.select().from(leaveRequests).where(eq(leaveRequests.employeeId, employee.id))
    .then(rows => rows.find(r => r.status === "approved" && today >= r.startDate && today <= r.endDate));
  if (onLeave && action === "clock_in") {
    await writeLog({ employeeId: employee.id, doorId: door.id, eventType: "leave_notice", result: "denied", reason: `İzinli gün (${onLeave.type}) giriş denemesi`, confidence: identified.confidence });
    return fail(`Bugün onaylı ${onLeave.type} iznindesiniz. İK onayı olmadan mesai başlatılamaz.`, { employee: person, door: doorInfo, confidence: identified.confidence, eventType: "leave_denied" });
  }
  // Anti-passback
  if (door.antiPassbackEnabled && (action === "clock_in" || action === "auto" || action === "door_only")) {
    const zone = door.zone || "genel";
    if (employee.insideZone === zone && door.type !== "exit") {
      await db.insert(securityAlarms).values({ type: "anti_passback", severity: "medium", employeeId: employee.id, doorId: door.id, message: `${name} anti-passback ihlali: zaten ${zone} içinde, çıkış yapmadan tekrar giriş` }).catch(() => {});
      await writeLog({ employeeId: employee.id, doorId: door.id, eventType: "anti_passback", result: "denied", reason: `Anti-passback: zaten ${zone} içinde`, confidence: identified.confidence });
      return fail(`Anti-passback ihlali: Zaten '${zone}' bölgesi içindesiniz, önce çıkış kapısını kullanın.`, { employee: person, door: doorInfo, confidence: identified.confidence, eventType: "anti_passback" });
    }
  }
  // Zone doluluk
  if (door.maxOccupancy) {
    const insideRows = await db.select().from(employees).where(eq(employees.insideZone, door.zone));
    if (insideRows.length >= door.maxOccupancy && employee.insideZone !== door.zone) {
      await db.insert(securityAlarms).values({ type: "occupancy", severity: "medium", doorId: door.id, message: `${door.zone} doluluk limiti (${door.maxOccupancy}) doldu` }).catch(() => {});
      return fail(`Bölge doluluk limiti doldu (${door.maxOccupancy} kişi). Bekleyin.`, { employee: person, door: doorInfo, eventType: "occupancy_denied" });
    }
  }

  const cooldownKey = `${employee.id}:${door.id}:${action}`;
  const last = lastScan.get(cooldownKey) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) {
    return fail("Aynı tarama çok kısa aralıkla tekrarlandı. Birkaç saniye bekleyin.", {
      result: "cooldown",
      employee: person,
      door: doorInfo,
      confidence: identified.confidence,
      matchDistance: identified.matchDistance,
      eventType: action,
    });
  }

  const permitted = await checkDoorPermission(employee.id, door, now);
  if (!permitted.ok) {
    lastScan.set(cooldownKey, Date.now());
    await writeLog({
      employeeId: employee.id,
      doorId: door.id,
      eventType: action,
      result: "denied",
      reason: permitted.reason,
      confidence: identified.confidence,
      snapshot: input.snapshot,
    });
    return fail(permitted.reason, {
      employee: person,
      door: doorInfo,
      confidence: identified.confidence,
      matchDistance: identified.matchDistance,
      eventType: action,
    });
  }

  lastScan.set(cooldownKey, Date.now());

  const attendance = await getOrCreateAttendance(employee.id, today);
  const currentBreak = await openBreakFor(employee.id);
  const resolved = resolveAutoAction({
    action,
    doorType: door.type,
    hasClockIn: Boolean(attendance.clockIn),
    hasClockOut: Boolean(attendance.clockOut),
    onBreak: Boolean(currentBreak),
  });

  let message = `${greeting(now)} ${name}.`;
  let eventType: string = resolved;
  let doorUnlocked = true;

  if (resolved === "clock_in") {
    if (attendance.clockIn && !attendance.clockOut) {
      eventType = "door_open";
      message = `${name}, bugün zaten giriş yaptınız (${timeHHmm(attendance.clockIn)}). Kapı açıldı.`;
    } else if (attendance.clockIn && attendance.clockOut) {
      await db
        .update(attendanceRecords)
        .set({ clockOut: null, notes: "Gün içinde yeniden giriş" })
        .where(eq(attendanceRecords.id, attendance.id));
      eventType = "clock_in";
      message = `${name}, yeniden girişiniz alındı. Kapı açıldı.`;
    } else {
      await db
        .update(attendanceRecords)
        .set({ clockIn: now, status: "present" })
        .where(eq(attendanceRecords.id, attendance.id));
      eventType = "clock_in";
      message = `${greeting(now)} ${name}, giriş imzanız alındı. İyi çalışmalar.`;
    }
  } else if (resolved === "clock_out") {
    if (!attendance.clockIn) {
      await writeLog({
        employeeId: employee.id,
        doorId: door.id,
        eventType: "clock_out",
        result: "denied",
        reason: "Önce giriş imzası gerekli",
        confidence: identified.confidence,
        snapshot: input.snapshot,
      });
      return fail("Bugün henüz giriş imzanız yok. Önce giriş yapın.", {
        employee: person,
        door: doorInfo,
        confidence: identified.confidence,
        matchDistance: identified.matchDistance,
        eventType: "clock_out",
      });
    }
    if (currentBreak) {
      const duration = minutesBetween(currentBreak.startedAt, now);
      await db
        .update(breaks)
        .set({ endedAt: now, durationMinutes: duration })
        .where(eq(breaks.id, currentBreak.id));
    }
    await db
      .update(attendanceRecords)
      .set({ clockOut: now })
      .where(eq(attendanceRecords.id, attendance.id));
    eventType = "clock_out";
    message = `${name}, çıkış imzanız alındı. İyi günler.`;
  } else if (resolved === "break_start") {
    if (!attendance.clockIn || attendance.clockOut) {
      await writeLog({
        employeeId: employee.id,
        doorId: door.id,
        eventType: "break_start",
        result: "denied",
        reason: "İstirahat için içeride olmalısınız",
        confidence: identified.confidence,
        snapshot: input.snapshot,
      });
      return fail("İstirahat başlatmak için önce giriş yapmış olmalısınız.", {
        employee: person,
        door: doorInfo,
        confidence: identified.confidence,
        matchDistance: identified.matchDistance,
        eventType: "break_start",
      });
    }
    if (currentBreak) {
      return fail("Zaten açık bir istirahat kaydınız var.", {
        employee: person,
        door: doorInfo,
        confidence: identified.confidence,
        matchDistance: identified.matchDistance,
        eventType: "break_start",
      });
    }
    await db.insert(breaks).values({
      employeeId: employee.id,
      attendanceId: attendance.id,
      type: input.breakType ?? "cay",
      startedAt: now,
    });
    eventType = "break_start";
    message = `${name}, istirahat başladı. İyi dinlenmeler.`;
  } else if (resolved === "break_end") {
    if (!currentBreak) {
      return fail("Açık istirahat kaydı bulunamadı.", {
        employee: person,
        door: doorInfo,
        confidence: identified.confidence,
        matchDistance: identified.matchDistance,
        eventType: "break_end",
      });
    }
    const duration = minutesBetween(currentBreak.startedAt, now);
    await db
      .update(breaks)
      .set({ endedAt: now, durationMinutes: duration })
      .where(eq(breaks.id, currentBreak.id));
    eventType = "break_end";
    message = `${name}, istirahat bitti (${duration} dk). Kapı açıldı.`;
  } else {
    eventType = "door_open";
    message = `${name}, kimlik doğrulandı. ${door.name} açıldı.`;
  }

  const updated = await recomputeAttendance(attendance.id);
  // InsideZone güncelle (roll-call + anti-passback)
  const newZone = resolved === "clock_out" ? null : (door.zone || "genel");
  await db.update(employees).set({ insideZone: newZone }).where(eq(employees.id, employee.id)).catch(() => {});

  await writeLog({
    employeeId: employee.id,
    doorId: door.id,
    eventType,
    result: "granted",
    reason: message,
    confidence: identified.confidence,
    livenessScore: input.livenessScore ?? 98.5,
    snapshot: input.snapshot,
  });

  return {
    ok: true,
    result: "granted",
    eventType,
    reason: permitted.reason,
    message,
    doorUnlocked,
    confidence: identified.confidence,
    matchDistance: identified.matchDistance,
    livenessScore: input.livenessScore ?? 98.5,
    isSpoof: false,
    employee: person,
    door: doorInfo,
    attendance: updated ? attendancePayload(updated) : attendancePayload(attendance),
    at: now.toISOString(),
  };
}
