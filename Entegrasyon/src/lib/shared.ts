// Uygulama genelinde paylaşılan sabitler, tipler ve takvim yardımcıları.

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
export const DAYS_FULL = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export type PersonnelType = 'ISCI' | 'MEMUR' | 'HEMSIRE';

/**
 * Personel grubu: aynı serviste iki ayrı ekip.
 * Her grubun KENDİ nöbet çizelgesi (sütun düzeni + atamalar), KENDİ puantajı
 * ve KENDİ çıktıları vardır; hesaplar grup bazında yapılır.
 */
export type StaffGroup = string;
/** Yerleşik gruplar. Kullanıcının elle eklediği gruplar "OZEL:<ad>" biçiminde saklanır. */
export const BUILTIN_STAFF_GROUPS = ['SAGLIK', 'DESTEK', 'TEKNISYEN'] as const;
export const STAFF_GROUP_ORDER: StaffGroup[] = [...BUILTIN_STAFF_GROUPS];
export const CUSTOM_GROUP_PREFIX = 'OZEL:';
export interface StaffGroupMeta {
  label: string; short: string; print: string; file: string; desc: string; badge: string; tab: string;
}
export const STAFF_GROUP_META: Record<string, StaffGroupMeta> = {
  SAGLIK: {
    label: 'Hemşire / Sağlık Personeli', short: 'Hemşire / Sağlık', print: 'HEMŞİRE / SAĞLIK PERSONELİ',
    file: 'hemsire', desc: 'Hemşire, ebe, ATT, sekreter…',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
    tab: 'bg-sky-500/25 text-sky-100 border-sky-400/60',
  },
  DESTEK: {
    label: 'Temizlik / Destek Personeli', short: 'Temizlik / Destek', print: 'TEMİZLİK / DESTEK PERSONELİ',
    file: 'temizlik', desc: 'Temizlik, hasta bakım, güvenlik, mutfak…',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    tab: 'bg-amber-500/25 text-amber-100 border-amber-400/60',
  },
  TEKNISYEN: {
    label: 'Teknisyen Personeli', short: 'Teknisyen', print: 'TEKNİSYEN PERSONELİ',
    file: 'teknisyen', desc: 'Teknisyen, teknikerler, bakım-onarım…',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/35',
    tab: 'bg-violet-500/25 text-violet-100 border-violet-400/60',
  },
};

export function isCustomGroup(g: string | null | undefined): boolean {
  return typeof g === 'string' && g.startsWith(CUSTOM_GROUP_PREFIX) && g.length > CUSTOM_GROUP_PREFIX.length;
}
/** Elle eklenen nöbet grubunun görünen adını temizler (2–30 karakter); geçersizse boş döner. */
export function cleanCustomLabel(v: unknown): string {
  const t = String(v ?? '').replace(/[\u0000-\u001f|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);
  return t.length >= 2 ? t : '';
}
export function makeCustomGroup(label: string): StaffGroup | '' {
  const l = cleanCustomLabel(label);
  return l ? CUSTOM_GROUP_PREFIX + l : '';
}
function asciiSlug(t: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u' };
  return t.toLocaleLowerCase('tr').replace(/[çğıiöşü]/g, c => map[c] ?? c).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'ozel';
}
/** Yerleşik veya elle eklenmiş grubun görünüm bilgileri (hiçbir zaman undefined dönmez). */
export function staffGroupMeta(g: string | null | undefined): StaffGroupMeta {
  if (g && STAFF_GROUP_META[g]) return STAFF_GROUP_META[g];
  if (isCustomGroup(g)) {
    const label = cleanCustomLabel((g as string).slice(CUSTOM_GROUP_PREFIX.length)) || 'Özel Nöbet';
    return {
      label, short: label, print: label.toLocaleUpperCase('tr'), file: asciiSlug(label),
      desc: 'Elle tanımlanan nöbet grubu',
      badge: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
      tab: 'bg-rose-500/25 text-rose-100 border-rose-400/60',
    };
  }
  return STAFF_GROUP_META.SAGLIK;
}
export function parseStaffGroup(v: unknown): StaffGroup {
  if (typeof v === 'string') {
    if ((BUILTIN_STAFF_GROUPS as readonly string[]).includes(v)) return v;
    if (v.startsWith(CUSTOM_GROUP_PREFIX)) {
      const label = cleanCustomLabel(v.slice(CUSTOM_GROUP_PREFIX.length));
      if (label) return CUSTOM_GROUP_PREFIX + label;
    }
  }
  return 'SAGLIK';
}
export function staffGroupOf(p: { staffGroup?: string | null }): StaffGroup {
  return parseStaffGroup(p.staffGroup);
}
/** Yeni sütun/servis adı önerisi: sağlık grubunda servis adı, diğerlerinde grubun adı. */
export function defaultServiceName(group: StaffGroup, deptName: string): string {
  if (group === 'SAGLIK') return deptName;
  if (group === 'DESTEK') return 'Temizlik';
  return staffGroupMeta(group).short;
}

// Tarayıcıda eklenen ama henüz personeli olmayan özel gruplar (AppShell yönetir).
let extraGroups: StaffGroup[] = [];
export function setExtraGroups(list: StaffGroup[]) { extraGroups = list.map(parseStaffGroup).filter(isCustomGroup); }
/** Tüm gruplar: yerleşikler + personelde geçen özel gruplar + tarayıcıda eklenenler. */
export function listStaffGroups(people: { staffGroup?: string | null }[] = []): StaffGroup[] {
  const custom = new Set<StaffGroup>(extraGroups);
  for (const p of people) { const g = parseStaffGroup(p.staffGroup); if (isCustomGroup(g)) custom.add(g); }
  return [...BUILTIN_STAFF_GROUPS, ...[...custom].sort((a, b) => a.localeCompare(b, 'tr'))];
}

/** Personel sınıfı kartları: İşçi / Memur / Hemşire. */
export const PERSONNEL_TYPE_META: Record<PersonnelType, {
  label: string; upper: string; short: string; desc: string; weekly: string;
  badge: string; chip: string; card: string;
}> = {
  MEMUR: {
    label: "Memur", upper: "MEMUR", short: "M", desc: "40 saat / hafta", weekly: "40s",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/35",
    chip: "type-memur",
    card: "bg-sky-500/25 border-sky-400/70 text-sky-200",
  },
  ISCI: {
    label: "İşçi", upper: "İŞÇİ", short: "İ", desc: "45 saat / hafta", weekly: "45s",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/35",
    chip: "type-isci",
    card: "bg-amber-500/25 border-amber-400/70 text-amber-200",
  },
  HEMSIRE: {
    label: "Hemşire", upper: "HEMŞİRE", short: "H", desc: "40 saat / hafta · nöbet düzeni", weekly: "40s",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
    chip: "type-hemsire",
    card: "bg-emerald-500/25 border-emerald-400/70 text-emerald-200",
  },
};

export const PERSONNEL_TYPE_ORDER: PersonnelType[] = ["MEMUR", "ISCI", "HEMSIRE"];

/** Personel ekleme/düzenleme ünvan önerileri (sağlık + destek + idari kadrolar). */
export const TITLE_SUGGESTIONS = [
  // Hemşirelik ve klinik
  "Hemşire", "Sorumlu Hemşire", "Servis Hemşiresi", "Yoğun Bakım Hemşiresi",
  "Acil Hemşiresi", "Ameliyathane Hemşiresi", "Ebe", "ATT", "Paramedik",
  "Sağlık Memuru", "Sağlık Teknikeri", "Hasta Bakıcı", "Hasta Taşıyıcı",
  // Tıbbi teknik
  "Tıbbi Sekreter", "Diyetisyen", "Fizyoterapist", "Laborant", "Laboratuvar Teknikeri",
  "Röntgen Teknisyeni", "Radyoloji Teknikeri", "Anestezi Teknikeri",
  "Diyaliz Teknikeri", "Eczane Teknikeri", "Sterilizasyon Personeli",
  "Doktor", "Pratisyen Hekim", "Uzman Hekim",
  // Temizlik ve destek (işçi kadrosu)
  "Temizlik Personeli", "Temizlik Görevlisi", "Kat Görevlisi", "Servis Personeli",
  "Yemekhane Personeli", "Aşçı", "Aşçı Yardımcısı", "Bulaşıkçı",
  "Çamaşırhane Personeli", "Ütücü", "Bahçıvan", "Tesisatçı",
  "Elektrikçi", "Teknik Servis", "Bakım Onarım Personeli", "Kaloriferci",
  "Güvenlik Görevlisi", "Bekçi", "Şoför", "Ambulans Şoförü",
  "Depo Görevlisi", "Satın Alma Personeli", "Arşiv Personeli",
  // İdari
  "Memur", "Büro Personeli", "Bilgi İşlem Personeli", "Vezne Görevlisi",
  "Danışma Personeli", "Hasta Kabul Memuru", "İnsan Kaynakları",
];

/** Temizlik / destek / teknik hizmet ünvanları → DESTEK grubu önerilir. */
const DESTEK_TITLES = new Set([
  "Hasta Bakıcı", "Hasta Taşıyıcı", "Sterilizasyon Personeli",
  "Temizlik Personeli", "Temizlik Görevlisi", "Kat Görevlisi", "Servis Personeli",
  "Yemekhane Personeli", "Aşçı", "Aşçı Yardımcısı", "Bulaşıkçı",
  "Çamaşırhane Personeli", "Ütücü", "Bahçıvan", "Tesisatçı",
  "Elektrikçi", "Teknik Servis", "Bakım Onarım Personeli", "Kaloriferci",
  "Güvenlik Görevlisi", "Bekçi", "Şoför", "Ambulans Şoförü", "Depo Görevlisi",
].map(t => t.toLocaleLowerCase("tr")));
const DESTEK_KEYWORDS = ["temizlik", "hasta bakım", "güvenlik", "aşçı", "yemek", "çamaşır", "şoför", "teknik", "bakım onarım", "bahçı", "kalorifer", "depo"];

/** Ünvana göre önerilen personel grubu (bilinmiyorsa null). */
export function suggestedGroupForTitle(title: string): StaffGroup | null {
  const t = title.trim().toLocaleLowerCase("tr");
  if (!t) return null;
  if (t.includes("teknisyen")) return "TEKNISYEN";
  if (DESTEK_TITLES.has(t) || DESTEK_KEYWORDS.some(k => t.includes(k))) return "DESTEK";
  if (TITLE_SUGGESTIONS.some(x => x.toLocaleLowerCase("tr") === t)) return "SAGLIK";
  return null;
}

export function personnelTypeLabel(t: string | null | undefined): string {
  if (t === "ISCI" || t === "MEMUR" || t === "HEMSIRE") return PERSONNEL_TYPE_META[t].label;
  return "Memur";
}

/** Rozete tıklayınca sınıfı döndürür: Memur → İşçi → Hemşire → Memur… */
export function cyclePersonnelType(t: string | null | undefined): PersonnelType {
  if (t === "MEMUR") return "ISCI";
  if (t === "ISCI") return "HEMSIRE";
  return "MEMUR";
}

export function isValidPersonnelType(t: unknown): t is PersonnelType {
  return t === "ISCI" || t === "MEMUR" || t === "HEMSIRE";
}

/** Türkçe alfabetik sıralama: Acil Servis → Dahiliye Servisi → Yoğun Bakım, "Ç"/"Ö"/"Ş" doğru yerde. */
export function trCompare(a: string, b: string): number {
  return String(a ?? "").localeCompare(String(b ?? ""), "tr-TR", { sensitivity: "base", numeric: true });
}

/** Servislerleri veya adı olan listeleri Türkçe alfabetik sırayla döner (stabil). */
export function sortByName<T extends { name?: string | null; id: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => trCompare(a.name ?? "", b.name ?? ""));
}

export type Department = {
  id: string; name: string;
  sorumluHemsire: string | null; hemsireUnvan: string | null;
  saglikBakimMuduru: string | null; saglikBakimUnvan: string | null;
  bashekim: string | null; bashekimUnvan: string | null;
  managerName: string | null;
};

export type Personnel = {
  id: string; name: string; fullName: string | null; tcNo: string | null;
  personnelType: PersonnelType; isActive: boolean; departmentId: string | null;
  staffGroup: StaffGroup;
  departmentIds: string[];
  title: string | null; phone: string | null; email: string | null;
  emergencyContact: string | null; address: string | null; startDate: string | null; notes: string | null;
  annualLeaveBalance: number | null; sickLeaveBalance: number | null; unpaidLeaveBalance: number | null;
  /** Profil fotoğrafı var mı (görsel ayrı uçtan sunulur, listeler hafif kalır). */
  hasAvatar?: boolean;
  /** Tarayıcı önbelleğini tazelemek için sürüm damgası. */
  avatarUpdatedAt?: string | null;
};

/** Personelin profil fotoğrafı adresi (yoksa null). */
export function avatarSrc(p: { id: string; hasAvatar?: boolean; avatarUpdatedAt?: string | null }): string | null {
  if (!p.hasAvatar) return null;
  const v = p.avatarUpdatedAt ? Date.parse(p.avatarUpdatedAt) || 0 : 0;
  return `/api/personnel/avatar/${p.id}${v ? `?v=${v}` : ""}`;
}

/** Ad-soyaddan baş harfler (fotoğraf yoksa yedek gösterim). */
export function personInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(x => x[0]).join("").slice(0, 2).toLocaleUpperCase("tr");
}

export type TimesheetEntry = {
  id: string; personnelId: string; entryDate: string; shiftType: string; hoursWorked: number; notes: string | null;
};

export type Holiday = { id: string; holidayDate: string; name: string };

export type ShiftSchedule = {
  id: string; departmentId: string; scheduleDate: string; personnelId: string;
  shiftSlot: string; shiftLabel: string | null; startTime: string | null; endTime: string | null;
  columnKey: string | null;
  notes: string | null; createdAt: string;
};

export type WeeklyOverride = {
  personnelId: string; weekIndex: number; worked: number | null; night: number | null; extra: number | null; holiday: number | null;
};

export type LeaveRequest = {
  id: string; personnelId: string; leaveType: string; startDate: string; endDate: string;
  daysCount: number; reason: string | null; status: string; approvalStage: string;
  reasonHemsire?: string | null;
  stageHemsireBy: string | null; stageHemsireAt: string | null;
  stageMudurBy: string | null; stageMudurAt: string | null;
  stageBashekimBy: string | null; stageBashekimAt: string | null;
  decidedBy: string | null; decidedAt: string | null; decisionNote: string | null;
  createdAt: string;
};

export type SwapRequest = {
  id: string; requesterId: string; requesterShiftId: string | null;
  targetPersonnelId: string | null; targetShiftId: string | null;
  swapDate: string; reason: string | null; status: string;
  decidedBy: string | null; decidedAt: string | null; createdAt: string;
};

/** Nöbet çizelgesi sütunu: ızgaranın "Hizmet (Saat aralığı)" başlıkları. */
export type DutyColumn = {
  id: string; departmentId: string; periodYear: number; periodMonth: number; staffGroup: string; key: string;
  service: string; shiftLabel: string; startTime: string; endTime: string; position: number;
};

/** Referans projeyle aynı: sütun anahtarı "Hizmet¦Saat Etiketi". */
export function dutyColumnKey(service: string, shiftLabel: string) {
  return `${String(service || "").trim()}¦${String(shiftLabel || "").trim()}`;
}
export function formatDutyColumn(c: { service: string; shiftLabel: string }) {
  return c.service ? `${c.service} (${c.shiftLabel})` : c.shiftLabel;
}

/** Vardiya şablonu = kaydedilmiş sütun düzeni (referans: duty-template-state). */
export type TemplateColumn = { service: string; shiftLabel: string; startTime: string; endTime: string };
export type ShiftTemplate = {
  id: string; departmentId: string | null; name: string; shiftCount: number; slots: TemplateColumn[] | unknown;
};

/** Eski (kişi-sayılı slot) ve yeni (sütun düzeni) şablon biçimlerini normalize eder. */
export function normalizeTemplateColumns(raw: unknown): TemplateColumn[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplateColumn[] = [];
  for (const item of raw as Record<string, unknown>[]) {
    if (!item || typeof item !== "object") continue;
    const start = String(item.start ?? item.startTime ?? "08:00");
    const end = String(item.end ?? item.endTime ?? "16:00");
    const service = String(item.service ?? "").trim();
    const shiftLabel = String(item.shiftLabel ?? item.label ?? `${start}–${end}`).trim();
    if (!shiftLabel) continue;
    out.push({ service, shiftLabel, startTime: start, endTime: end });
  }
  return out;
}

export type Announcement = {
  id: string; departmentId: string | null; title: string; body: string; kind: string;
  createdBy: string | null; createdAt: string;
};

// ─── Takvim yardımcıları ───
export function dayName(year: number, month: number, day: number) {
  return DAYS_TR[new Date(year, month, day).getDay()];
}
export function isWeekendDay(year: number, month: number, day: number) {
  const d = new Date(year, month, day).getDay();
  return d === 0 || d === 6;
}
export function isWeeklyRestDay(year: number, month: number, day: number) {
  return new Date(year, month, day).getDay() === 0;
}
export function buildWeeks(year: number, month: number, daysInMonth: number): number[][] {
  const weeks: number[][] = [];
  let week: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (new Date(year, month, d).getDay() === 0 || d === daysInMonth) {
      weeks.push(week);
      week = [];
    }
  }
  return weeks;
}
export function requiredDailyHours(type: PersonnelType | string) {
  if (type === 'ISCI') return 7.5;   // İşçi: 45 saat / hafta
  return 40 / 6;                      // Memur + Hemşire: 40 saat / hafta
}

export function fmtDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function fmtTr(dateStr: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}
export function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

export function personnelInDepartment(p: Personnel, deptId: string) {
  return p.departmentId === deptId || p.departmentIds.includes(deptId);
}

// ─── Vardiya saat aralıkları (kaynak projedeki SHIFT_SLOTS) ───
export const SHIFT_SLOTS: { key: string; label: string; start: string; end: string; isNight: boolean }[] = [
  { key: '07-19', label: '07:00 – 19:00 (12s Gündüz)', start: '07:00', end: '19:00', isNight: false },
  { key: '19-07', label: '19:00 – 07:00 (12s Gece)',   start: '19:00', end: '07:00', isNight: true  },
  { key: '08-20', label: '08:00 – 20:00 (12s Gündüz)', start: '08:00', end: '20:00', isNight: false },
  { key: '20-08', label: '20:00 – 08:00 (12s Gece)',   start: '20:00', end: '08:00', isNight: true  },
  { key: '06-14', label: '06:00 – 14:00 (8s Gündüz)',  start: '06:00', end: '14:00', isNight: false },
  { key: '14-22', label: '14:00 – 22:00 (8s Akşam)',   start: '14:00', end: '22:00', isNight: false },
  { key: '22-06', label: '22:00 – 06:00 (8s Gece)',    start: '22:00', end: '06:00', isNight: true  },
  { key: '08-16', label: '08:00 – 16:00 (8s Gündüz)',  start: '08:00', end: '16:00', isNight: false },
  { key: '16-24', label: '16:00 – 00:00 (8s Akşam)',   start: '16:00', end: '00:00', isNight: false },
  { key: '00-08', label: '00:00 – 08:00 (8s Gece)',    start: '00:00', end: '08:00', isNight: true  },
  { key: '09-17', label: '09:00 – 17:00 (8s Gündüz)',  start: '09:00', end: '17:00', isNight: false },
  { key: 'YEMEK', label: 'Yemek Ocağı (8s)',           start: '08:00', end: '16:00', isNight: false },
  { key: 'CUSTOM', label: 'Özel (saat aralığını sen seç)', start: '08:00', end: '16:00', isNight: false },
];

export function slotByKey(key: string) {
  return SHIFT_SLOTS.find(s => s.key === key);
}

// Nöbet çizelgesi gün başlığında gösterilen hizmet satırları (kaynak projedeki DUTY_COLUMNS)
export const DUTY_SLOTS = ['07-19', '06-14', '19-07'];

// ─── İzin tipleri (kaynak LEAVE_TYPES) ───
export type LeaveTypeKey = 'YILLIK' | 'MAZERET' | 'RAPOR' | 'UCRETSIZ' | 'IDARI' | 'DOGUM' | 'BABALIK' | 'OLUM' | 'EVLILIK';

export const LEAVE_TYPES: { key: LeaveTypeKey; label: string; code: string; color: string }[] = [
  { key: 'YILLIK',   label: 'Yıllık İzin',       code: 'YIL', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { key: 'MAZERET',  label: 'Mazeret İzni',      code: 'MAZ', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  { key: 'RAPOR',    label: 'Rapor (Sağlık)',    code: 'RAP', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  { key: 'UCRETSIZ', label: 'Ücretsiz İzin',     code: 'ÜCR', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { key: 'IDARI',    label: 'İdari İzin',        code: 'İDA', color: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
  { key: 'DOGUM',    label: 'Doğum İzni',        code: 'DOĞ', color: 'bg-pink-500/20 text-pink-300 border-pink-500/40' },
  { key: 'BABALIK',  label: 'Babalık İzni',      code: 'BAB', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
  { key: 'OLUM',     label: 'Ölüm İzni',         code: 'ÖLÜ', color: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
  { key: 'EVLILIK',  label: 'Evlilik İzni',      code: 'EVL', color: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40' },
];

export const LEAVE_CODE_MAP: Record<string, { code: string; label: string; color: string }> =
  Object.fromEntries(LEAVE_TYPES.map(t => [t.key, { code: t.code, label: t.label, color: t.color }]));

/** Puantaj hücresinde izin kodunu gösterirken kullanılacak ters eşleme (YILLIK → YIL) */
export function leaveCodeFor(shiftType: string): string | null {
  return LEAVE_CODE_MAP[shiftType]?.code ?? null;
}

export const APPROVAL_FLOW: { stage: string; label: string; short: string }[] = [
  { stage: 'HEMSIRE',  label: 'Sorumlu Hemşire Onayı', short: 'Sorumlu Hemşire' },
  { stage: 'MUDUR',    label: 'Sağlık Bakım Müdürü Onayı', short: 'Sağlık Bakım Müdürü' },
  { stage: 'BASHEKIM', label: 'Başhekim Onayı', short: 'Başhekim' },
];

export function nextStage(s: string): string {
  return s === 'HEMSIRE' ? 'MUDUR' : s === 'MUDUR' ? 'BASHEKIM' : 'DONE';
}

/** Vardiya saat aralığı 22:00–06:00 penceresine giriyorsa "gece" say (kaynak projeyle aynı). */
export function isNightRange(start?: string | null, end?: string | null): boolean {
  if (!start || !end) return false;
  const [sh] = start.split(':').map(Number);
  const [eh] = end.split(':').map(Number);
  if (eh < sh) return true;
  if (sh >= 20 || sh < 6) return true;
  if (eh <= 6) return true;
  return false;
}

/** Saat çakışması kontrolü için aralık yardımcıları (kaynak projeyle aynı). */
export function toIntervals(start: string, end: string): Array<[number, number]> {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm;
  const e0 = eh * 60 + em;
  if (e0 <= s) return [[s, 1440], [0, e0]];
  return [[s, e0]];
}
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const A = toIntervals(aStart, aEnd);
  const B = toIntervals(bStart, bEnd);
  for (const [as, ae] of A) for (const [bs, be] of B) {
    if (as < be && bs < ae) return true;
  }
  return false;
}
