import { db } from "@/db";
import { personnel, departments, shiftSchedules, leaveRequests, timesheetEntries, holidays } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Türkçe karakterleri küçük harfe ve temel harflere normalize eder (esnek eşleşme için). */
function normalizeTr(s: string): string {
  return String(s ?? "")
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr-TR")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** Personel isim/soyisim parçalarını çıkartır. */
function namePartsOf(p: { name?: string | null; fullName?: string | null }): string[] {
  const out: string[] = [];
  for (const v of [p.fullName, p.name]) {
    if (!v) continue;
    const parts = v.trim().split(/\s+/).filter(Boolean);
    out.push(...parts);
    if (parts.length > 1) {
      out.push(parts[parts.length - 1]); // soyadı
      out.push(parts.join(" ")); // tam adı
      out.push(parts.slice(1).join(" ")); // 2+ isim varsa soyadlar
    }
  }
  return [...new Set(out)];
}

/** Soyad veya isim eşleşmesini test eder. */
function matchesSurname(person: { name?: string | null; fullName?: string | null }, input: string): boolean {
  const cleanInput = normalizeTr(input);
  if (!cleanInput || cleanInput.length < 2) return false;
  const parts = namePartsOf(person);
  for (const part of parts) {
    const cleanPart = normalizeTr(part);
    if (cleanPart === cleanInput) return true;
    if (cleanPart.endsWith(cleanInput) || cleanInput.endsWith(cleanPart)) return true;
  }
  return false;
}

/** Ad + soyad eşleşmesi: girilen her sözcük personelin adındaki bir sözcükle birebir eşleşmeli (en az 2 sözcük). */
function matchesFullName(person: { name?: string | null; fullName?: string | null }, input: string): boolean {
  const inputTokens = String(input ?? "").trim().split(/\s+/).map(normalizeTr).filter(Boolean);
  if (inputTokens.length < 2) return false;
  const source = person.fullName || person.name || "";
  const personTokens = source.trim().split(/\s+/).map(normalizeTr).filter(Boolean);
  if (personTokens.length < 2) return false;
  return inputTokens.every(t => personTokens.includes(t));
}

/**
 * Şifresiz, salt-okunur personel sorgusu. Üç yöntem desteklenir:
 *   • yalnızca TC Kimlik No (11 hane),
 *   • yalnızca Ad Soyad (en az 2 sözcük; birden fazla kişiyle eşleşirse reddedilir),
 *   • TC + soyad (eski yöntem, geriye dönük uyumluluk).
 * Doğrulanan kişinin kendi nöbet, izin ve puantaj verisi döner.
 * Eski açıklama:
 * 11 haneli TC + soyad doğrulanırsa o kişinin kendi nöbet, izin ve puantaj verisi döner.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tc = String(body.tcNo ?? "").replace(/\D/g, "");
    const surname = String(body.surname ?? "").trim();
    const fullName = String(body.fullName ?? "").trim();

    let person: typeof personnel.$inferSelect | undefined;

    if (fullName) {
      // — Yalnızca ad soyad ile sorgu —
      if (fullName.split(/\s+/).filter(Boolean).length < 2) {
        return Response.json({ error: "Lütfen adınızı ve soyadınızı birlikte girin (örn. Ayşe Çelik)." }, { status: 400 });
      }
      const actives = await db.select().from(personnel).where(eq(personnel.isActive, true));
      const found = actives.filter(p => matchesFullName(p, fullName));
      if (found.length === 0) {
        return Response.json({ error: "Girdiğiniz ad soyada ait aktif personel kaydı bulunamadı. Yazımı kontrol edin." }, { status: 404 });
      }
      if (found.length > 1) {
        return Response.json({ error: "Bu ad soyad ile birden fazla kayıt var. Lütfen TC Kimlik No ile sorgulayın." }, { status: 409 });
      }
      person = found[0];
    } else if (tc && !surname) {
      // — Yalnızca TC Kimlik No ile sorgu —
      if (tc.length !== 11) {
        return Response.json({ error: "Lütfen 11 haneli TC Kimlik Numaranızı girin." }, { status: 400 });
      }
      const matches = await db.select().from(personnel)
        .where(and(eq(personnel.tcNo, tc), eq(personnel.isActive, true))).limit(2);
      if (matches.length === 0) {
        return Response.json({ error: "Girdiğiniz TC Kimlik Numarasına ait aktif personel kaydı bulunamadı." }, { status: 404 });
      }
      person = matches[0];
    } else {
      // — TC + soyad (eski yöntem) —
      if (!tc || tc.length !== 11) {
        return Response.json({ error: "Lütfen 11 haneli TC Kimlik Numaranızı girin." }, { status: 400 });
      }
      if (!surname || surname.length < 2) {
        return Response.json({ error: "Lütfen en az 2 karakterden oluşan soyadınızı girin." }, { status: 400 });
      }
      const matches = await db.select().from(personnel)
        .where(and(eq(personnel.tcNo, tc), eq(personnel.isActive, true))).limit(5);
      if (matches.length === 0) {
        return Response.json({ error: "Girdiğiniz TC Kimlik Numarasına ait aktif personel kaydı bulunamadı." }, { status: 404 });
      }
      person = matches.find(p => matchesSurname(p, surname));
      if (!person) {
        return Response.json({ error: "Girdiğiniz soyad sistemdeki personel kaydıyla eşleşmedi. Lütfen soyadınızı kontrol edin." }, { status: 400 });
      }
    }

    const nowDt = new Date();
    const year = Number(body.year) || nowDt.getFullYear();
    const month = Number.isInteger(body.month) ? Number(body.month) : nowDt.getMonth();
    const dim = new Date(year, month + 1, 0).getDate();
    const startD = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endD = `${year}-${String(month + 1).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;

    const [schedules, leaves, entries, hols, dept] = await Promise.all([
      db.select().from(shiftSchedules).where(and(
        eq(shiftSchedules.personnelId, person.id),
        gte(shiftSchedules.scheduleDate, startD), lte(shiftSchedules.scheduleDate, endD))),
      db.select().from(leaveRequests).where(eq(leaveRequests.personnelId, person.id)),
      db.select().from(timesheetEntries).where(and(
        eq(timesheetEntries.personnelId, person.id),
        gte(timesheetEntries.entryDate, startD), lte(timesheetEntries.entryDate, endD))),
      db.select().from(holidays).where(and(gte(holidays.holidayDate, startD), lte(holidays.holidayDate, endD))),
      person.departmentId
        ? db.select().from(departments).where(eq(departments.id, person.departmentId)).limit(1)
        : Promise.resolve([]),
    ]);

    return Response.json({
      person: {
        id: person.id,
        name: person.name,
        title: person.title,
        personnelType: person.personnelType,
        departmentName: dept[0]?.name ?? null,
        annualLeaveBalance: person.annualLeaveBalance,
        sickLeaveBalance: person.sickLeaveBalance,
        unpaidLeaveBalance: person.unpaidLeaveBalance,
        hasAvatar: Boolean(person.avatarMime),
        avatarUpdatedAt: person.avatarUpdatedAt ? new Date(person.avatarUpdatedAt).toISOString() : null,
      },
      year,
      month,
      schedules: schedules.sort((a, b) => a.scheduleDate.localeCompare(b.scheduleDate)),
      leaves: leaves
        .filter(l => l.status !== "CANCELLED")
        .map(l => ({
          id: l.id,
          leaveType: l.leaveType,
          startDate: l.startDate,
          endDate: l.endDate,
          daysCount: l.daysCount,
          status: l.status,
          reason: l.reason,
        }))
        .sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 24),
      entries,
      holidays: hols,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Sorgu sırasında beklenmeyen bir hata oluştu." }, { status: 500 });
  }
}
