import { db } from "@/db";
import {
  accessLogs,
  attendanceRecords,
  breaks,
  departments,
  doorPermissions,
  doors,
  employees,
  shifts,
} from "@/db/face-schema";
import { parseIstanbul, recentWeekdays, todayISO } from "@/lib/time";

let seedPromise: Promise<void> | null = null;

function jitter(base: string, plusMinus: number) {
  const [h, m] = base.split(":").map(Number);
  const total = h * 60 + m + Math.round((Math.random() * 2 - 1) * plusMinus);
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

async function runSeed() {
  const deptRows = await db
    .insert(departments)
    .values([
      { name: "İnsan Kaynakları", code: "IK", color: "#e8c36a" },
      { name: "Üretim", code: "URT", color: "#fb923c" },
      { name: "Bilgi Teknolojileri", code: "IT", color: "#22d3ee" },
      { name: "Muhasebe", code: "MUH", color: "#a78bfa" },
      { name: "Güvenlik", code: "GUV", color: "#34d399" },
      { name: "Lojistik", code: "LOJ", color: "#60a5fa" },
      { name: "Yönetim", code: "YON", color: "#f472b6" },
    ])
    .returning();

  const dept = Object.fromEntries(deptRows.map((row) => [row.code, row]));

  const shiftRows = await db
    .insert(shifts)
    .values([
      {
        name: "Gündüz Vardiyası",
        startTime: "08:00",
        endTime: "17:00",
        breakAllowanceMinutes: 45,
        lateToleranceMinutes: 10,
        color: "#fb923c",
      },
      {
        name: "Ofis Mesaisi",
        startTime: "09:00",
        endTime: "18:00",
        breakAllowanceMinutes: 60,
        lateToleranceMinutes: 15,
        color: "#818cf8",
      },
      {
        name: "Akşam Vardiyası",
        startTime: "16:00",
        endTime: "00:00",
        breakAllowanceMinutes: 45,
        lateToleranceMinutes: 10,
        color: "#38bdf8",
      },
    ])
    .returning();

  const shiftByName = Object.fromEntries(shiftRows.map((row) => [row.name, row]));

  const doorRows = await db
    .insert(doors)
    .values([
      {
        name: "Ana Turnike Giriş",
        code: "ANA-IN",
        location: "Plaza zemin kat lobi",
        type: "entry",
        accessPolicy: "permission",
        imageUrl: "/scenes/turnstile.jpg",
        description: "Personel giriş imzası ve lobi turnikesi",
      },
      {
        name: "Ana Turnike Çıkış",
        code: "ANA-OUT",
        location: "Plaza zemin kat lobi",
        type: "exit",
        accessPolicy: "permission",
        imageUrl: "/scenes/gate.jpg",
        description: "Mesai bitişi ve ziyaretçi çıkışı",
      },
      {
        name: "Üretim Holü",
        code: "URT-01",
        location: "Fabrika A blok",
        type: "both",
        accessPolicy: "permission",
        imageUrl: "/scenes/office.jpg",
        description: "Üretim sahası personel geçişi",
      },
      {
        name: "Sunucu Odası",
        code: "DC-01",
        location: "Bodrum data center",
        type: "both",
        accessPolicy: "permission",
        imageUrl: "/scenes/server.jpg",
        description: "Kritik alan — yalnızca IT ve güvenlik",
      },
      {
        name: "Yönetim Katı",
        code: "YON-04",
        location: "4. kat cam ofisler",
        type: "both",
        accessPolicy: "permission",
        imageUrl: "/scenes/office.jpg",
        description: "Yönetim ve misafir toplantı alanı",
      },
      {
        name: "Sevkiyat Deposu",
        code: "DEP-01",
        location: "Lojistik sahası",
        type: "both",
        accessPolicy: "permission",
        imageUrl: "/scenes/gate.jpg",
        description: "Forklift ve sevkiyat kapısı",
      },
      {
        name: "Yemekhane",
        code: "YMK-01",
        location: "Sosyal tesis",
        type: "both",
        accessPolicy: "all",
        imageUrl: "/scenes/office.jpg",
        description: "Tüm personel — kart/yüz ile geçiş",
      },
    ])
    .returning();

  const door = Object.fromEntries(doorRows.map((row) => [row.code, row]));

  const people = [
    {
      employeeNo: "ORN-1001",
      firstName: "Elif",
      lastName: "Demir",
      email: "elif.demir@orion-endustri.tr",
      phone: "0532 111 10 01",
      departmentId: dept.IK.id,
      shiftId: shiftByName["Ofis Mesaisi"].id,
      title: "İK Müdürü",
      photoUrl: "/portraits/elif.jpg",
      hireDate: "2018-03-12",
    },
    {
      employeeNo: "ORN-1002",
      firstName: "Mehmet",
      lastName: "Kaya",
      email: "mehmet.kaya@orion-endustri.tr",
      phone: "0532 111 10 02",
      departmentId: dept.URT.id,
      shiftId: shiftByName["Gündüz Vardiyası"].id,
      title: "Üretim Şefi",
      photoUrl: "/portraits/mehmet.jpg",
      hireDate: "2016-09-01",
    },
    {
      employeeNo: "ORN-1003",
      firstName: "Ayşe",
      lastName: "Yılmaz",
      email: "ayse.yilmaz@orion-endustri.tr",
      phone: "0532 111 10 03",
      departmentId: dept.MUH.id,
      shiftId: shiftByName["Ofis Mesaisi"].id,
      title: "Bordro Uzmanı",
      photoUrl: "/portraits/ayse.jpg",
      hireDate: "2019-01-21",
    },
    {
      employeeNo: "ORN-1004",
      firstName: "Can",
      lastName: "Özkan",
      email: "can.ozkan@orion-endustri.tr",
      phone: "0532 111 10 04",
      departmentId: dept.IT.id,
      shiftId: shiftByName["Ofis Mesaisi"].id,
      title: "Yazılım Geliştirici",
      photoUrl: "/portraits/can.jpg",
      hireDate: "2021-06-14",
    },
    {
      employeeNo: "ORN-1005",
      firstName: "Zeynep",
      lastName: "Arslan",
      email: "zeynep.arslan@orion-endustri.tr",
      phone: "0532 111 10 05",
      departmentId: dept.GUV.id,
      shiftId: shiftByName["Gündüz Vardiyası"].id,
      title: "Güvenlik Amiri",
      photoUrl: "/portraits/zeynep.jpg",
      hireDate: "2017-11-03",
    },
    {
      employeeNo: "ORN-1006",
      firstName: "Emre",
      lastName: "Çelik",
      email: "emre.celik@orion-endustri.tr",
      phone: "0532 111 10 06",
      departmentId: dept.IT.id,
      shiftId: shiftByName["Ofis Mesaisi"].id,
      title: "Sistem Yöneticisi",
      photoUrl: "/portraits/emre.jpg",
      hireDate: "2020-02-10",
    },
    {
      employeeNo: "ORN-1007",
      firstName: "Selin",
      lastName: "Aydın",
      email: "selin.aydin@orion-endustri.tr",
      phone: "0532 111 10 07",
      departmentId: dept.YON.id,
      shiftId: shiftByName["Ofis Mesaisi"].id,
      title: "Yönetim Asistanı",
      photoUrl: "/portraits/selin.jpg",
      hireDate: "2022-04-18",
    },
    {
      employeeNo: "ORN-1008",
      firstName: "Burak",
      lastName: "Şahin",
      email: "burak.sahin@orion-endustri.tr",
      phone: "0532 111 10 08",
      departmentId: dept.URT.id,
      shiftId: shiftByName["Gündüz Vardiyası"].id,
      title: "CNC Operatörü",
      photoUrl: "/portraits/burak.jpg",
      hireDate: "2019-08-26",
    },
    {
      employeeNo: "ORN-1009",
      firstName: "Deniz",
      lastName: "Koç",
      email: "deniz.koc@orion-endustri.tr",
      phone: "0532 111 10 09",
      departmentId: dept.IT.id,
      shiftId: shiftByName["Ofis Mesaisi"].id,
      title: "Ağ Uzmanı",
      photoUrl: "/portraits/deniz.jpg",
      hireDate: "2023-01-09",
    },
    {
      employeeNo: "ORN-1010",
      firstName: "Fatma",
      lastName: "Aksoy",
      email: "fatma.aksoy@orion-endustri.tr",
      phone: "0532 111 10 10",
      departmentId: dept.MUH.id,
      shiftId: shiftByName["Ofis Mesaisi"].id,
      title: "Muhasebe Uzmanı",
      photoUrl: "/portraits/fatma.jpg",
      hireDate: "2018-10-30",
    },
    {
      employeeNo: "ORN-1011",
      firstName: "Hakan",
      lastName: "Yıldız",
      email: "hakan.yildiz@orion-endustri.tr",
      phone: "0532 111 10 11",
      departmentId: dept.LOJ.id,
      shiftId: shiftByName["Gündüz Vardiyası"].id,
      title: "Depo Sorumlusu",
      photoUrl: "/portraits/hakan.jpg",
      hireDate: "2015-05-04",
    },
    {
      employeeNo: "ORN-1012",
      firstName: "Merve",
      lastName: "Polat",
      email: "merve.polat@orion-endustri.tr",
      phone: "0532 111 10 12",
      departmentId: dept.URT.id,
      shiftId: shiftByName["Gündüz Vardiyası"].id,
      title: "Kalite Kontrol",
      photoUrl: "/portraits/merve.jpg",
      hireDate: "2024-02-12",
    },
  ];

  const employeeRows = await db.insert(employees).values(people).returning();
  const emp = Object.fromEntries(employeeRows.map((row) => [row.employeeNo, row]));

  const weekdays = [1, 2, 3, 4, 5];
  const allDays = [1, 2, 3, 4, 5, 6, 7];

  const permissionValues: (typeof doorPermissions.$inferInsert)[] = [];

  for (const person of employeeRows) {
    permissionValues.push(
      {
        employeeId: person.id,
        doorId: door["ANA-IN"].id,
        daysOfWeek: weekdays,
        startTime: "06:30",
        endTime: "22:00",
        isActive: true,
      },
      {
        employeeId: person.id,
        doorId: door["ANA-OUT"].id,
        daysOfWeek: weekdays,
        startTime: "06:30",
        endTime: "23:59",
        isActive: true,
      },
    );
  }

  for (const person of employeeRows.filter((row) => row.departmentId === dept.URT.id)) {
    permissionValues.push({
      employeeId: person.id,
      doorId: door["URT-01"].id,
      daysOfWeek: weekdays,
      startTime: "07:00",
      endTime: "18:30",
      isActive: true,
    });
  }

  for (const person of employeeRows.filter((row) => row.departmentId === dept.IT.id)) {
    permissionValues.push({
      employeeId: person.id,
      doorId: door["DC-01"].id,
      daysOfWeek: weekdays,
      startTime: "08:00",
      endTime: "22:00",
      isActive: true,
    });
  }

  permissionValues.push(
    {
      employeeId: emp["ORN-1001"].id,
      doorId: door["YON-04"].id,
      daysOfWeek: weekdays,
      startTime: "08:00",
      endTime: "20:00",
      isActive: true,
    },
    {
      employeeId: emp["ORN-1007"].id,
      doorId: door["YON-04"].id,
      daysOfWeek: weekdays,
      startTime: "08:00",
      endTime: "20:00",
      isActive: true,
    },
    {
      employeeId: emp["ORN-1011"].id,
      doorId: door["DEP-01"].id,
      daysOfWeek: weekdays,
      startTime: "07:00",
      endTime: "19:00",
      isActive: true,
    },
  );

  for (const gate of doorRows) {
    permissionValues.push({
      employeeId: emp["ORN-1005"].id,
      doorId: gate.id,
      daysOfWeek: allDays,
      startTime: "00:00",
      endTime: "23:59",
      isActive: true,
    });
  }

  await db.insert(doorPermissions).values(permissionValues);

  const historyDays = recentWeekdays(5);
  const today = todayISO();
  const pastDays = historyDays.filter((day) => day !== today);
  const now = new Date();

  const attendanceValues: (typeof attendanceRecords.$inferInsert)[] = [];
  const breakValues: (typeof breaks.$inferInsert)[] = [];
  const logValues: (typeof accessLogs.$inferInsert)[] = [];

  const shiftMap = Object.fromEntries(shiftRows.map((row) => [row.id, row]));

  for (const day of pastDays) {
    for (const person of employeeRows) {
      if (person.employeeNo === "ORN-1006" && day === pastDays[pastDays.length - 1]) {
        attendanceValues.push({
          employeeId: person.id,
          workDate: day,
          status: "absent",
          notes: "Raporlu",
        });
        continue;
      }
      const shift = person.shiftId ? shiftMap[person.shiftId] : null;
      const inTime = jitter(shift?.startTime ?? "09:00", 18);
      const outTime = jitter(shift?.endTime === "00:00" ? "23:50" : (shift?.endTime ?? "18:00"), 22);
      const clockIn = parseIstanbul(day, inTime);
      const clockOut = parseIstanbul(day, outTime <= inTime ? "17:42" : outTime);
      const breakStart = parseIstanbul(day, "12:05");
      const breakEnd = parseIstanbul(day, "12:47");
      const late = shift
        ? Math.max(
            0,
            Math.round((clockIn.getTime() - parseIstanbul(day, shift.startTime).getTime()) / 60000),
          )
        : 0;
      const breakMin = 42;
      const workMin = Math.max(
        0,
        Math.round((clockOut.getTime() - clockIn.getTime()) / 60000) - breakMin,
      );
      attendanceValues.push({
        employeeId: person.id,
        workDate: day,
        clockIn,
        clockOut,
        status: late > (shift?.lateToleranceMinutes ?? 10) ? "late" : "present",
        workMinutes: workMin,
        breakMinutes: breakMin,
        overtimeMinutes: 0,
        lateMinutes: late > (shift?.lateToleranceMinutes ?? 10) ? late : 0,
      });
      breakValues.push({
        employeeId: person.id,
        type: "yemek",
        startedAt: breakStart,
        endedAt: breakEnd,
        durationMinutes: breakMin,
      });
      logValues.push(
        {
          employeeId: person.id,
          doorId: door["ANA-IN"].id,
          eventType: "clock_in",
          result: "granted",
          reason: "Giriş imzası",
          confidence: 0.91,
          createdAt: clockIn,
        },
        {
          employeeId: person.id,
          doorId: door["ANA-OUT"].id,
          eventType: "clock_out",
          result: "granted",
          reason: "Çıkış imzası",
          confidence: 0.89,
          createdAt: clockOut,
        },
      );
    }
  }

  const plannedToday: Record<
    string,
    { in?: string; out?: string; breakStart?: string; absent?: boolean }
  > = {
    "ORN-1001": { in: "08:47" },
    "ORN-1002": { in: "07:51" },
    "ORN-1003": { in: "09:18" },
    "ORN-1004": { in: "09:02", breakStart: "12:01" },
    "ORN-1005": { in: "07:40" },
    "ORN-1006": { absent: true },
    "ORN-1007": { in: "08:56" },
    "ORN-1008": { in: "08:04" },
    "ORN-1009": { in: "09:12" },
    "ORN-1010": { in: "09:05" },
    "ORN-1011": { in: "08:11", out: "12:28" },
    "ORN-1012": {},
  };

  for (const person of employeeRows) {
    const plan = plannedToday[person.employeeNo] ?? {};
    const shift = person.shiftId ? shiftMap[person.shiftId] : null;
    if (plan.absent || !plan.in) {
      attendanceValues.push({
        employeeId: person.id,
        workDate: today,
        status: "absent",
        notes: plan.absent ? "İzinli / gelmedi" : null,
      });
      continue;
    }

    const clockIn = parseIstanbul(today, plan.in);
    if (clockIn > now) {
      attendanceValues.push({
        employeeId: person.id,
        workDate: today,
        status: "absent",
      });
      continue;
    }

    const clockOut = plan.out ? parseIstanbul(today, plan.out) : null;
    const validOut = clockOut && clockOut <= now ? clockOut : null;
    const late = shift
      ? Math.max(
          0,
          Math.round((clockIn.getTime() - parseIstanbul(today, shift.startTime).getTime()) / 60000),
        )
      : 0;
    const lateMinutes = late > (shift?.lateToleranceMinutes ?? 10) ? late : 0;

    attendanceValues.push({
      employeeId: person.id,
      workDate: today,
      clockIn,
      clockOut: validOut,
      status: lateMinutes > 0 ? "late" : "present",
      lateMinutes,
      workMinutes: 0,
      breakMinutes: 0,
    });

    logValues.push({
      employeeId: person.id,
      doorId: door["ANA-IN"].id,
      eventType: "clock_in",
      result: "granted",
      reason: "Giriş imzası",
      confidence: 0.93,
      createdAt: clockIn,
    });

    if (validOut) {
      logValues.push({
        employeeId: person.id,
        doorId: door["ANA-OUT"].id,
        eventType: "clock_out",
        result: "granted",
        reason: "Çıkış imzası",
        confidence: 0.9,
        createdAt: validOut,
      });
    }

    if (plan.breakStart) {
      const started = parseIstanbul(today, plan.breakStart);
      if (started <= now) {
        breakValues.push({
          employeeId: person.id,
          type: "cay",
          startedAt: started,
        });
        logValues.push({
          employeeId: person.id,
          doorId: door["YMK-01"].id,
          eventType: "break_start",
          result: "granted",
          reason: "İstirahat başladı",
          createdAt: started,
        });
      }
    }
  }

  logValues.push({
    employeeId: emp["ORN-1004"].id,
    doorId: door["DC-01"].id,
    eventType: "door_open",
    result: "granted",
    reason: "Sunucu odası açıldı",
    confidence: 0.88,
    createdAt: parseIstanbul(today, "09:40"),
  });
  logValues.push({
    employeeId: emp["ORN-1012"].id,
    doorId: door["DC-01"].id,
    eventType: "denied",
    result: "denied",
    reason: "Bu kapıya tanımlı yetkiniz yok.",
    confidence: 0.81,
    createdAt: parseIstanbul(today, "09:44"),
  });

  const insertedAttendance = await db.insert(attendanceRecords).values(attendanceValues).returning();
  const attendanceByKey = new Map(
    insertedAttendance.map((row) => [`${row.employeeId}:${row.workDate}`, row]),
  );

  const linkedBreaks = breakValues.map((item) => {
    const date = todayISO(item.startedAt as Date);
    const att = attendanceByKey.get(`${item.employeeId}:${date}`);
    return { ...item, attendanceId: att?.id ?? null };
  });

  if (linkedBreaks.length) await db.insert(breaks).values(linkedBreaks);
  if (logValues.length) await db.insert(accessLogs).values(logValues);
}

export async function ensureSeed() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await db.select({ id: departments.id }).from(departments).limit(1);
      if (existing.length > 0) return;
      await runSeed();
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  await seedPromise;
}
