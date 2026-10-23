export const TZ = "Europe/Istanbul";

export function todayISO(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

export function timeHHmm(date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function isoWeekday(date = new Date()): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[wd] ?? 1;
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00+03:00`);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function parseIstanbul(dateISO: string, time: string): Date {
  const hhmm = time.length === 5 ? `${time}:00` : time;
  return new Date(`${dateISO}T${hhmm}+03:00`);
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

export function shiftWindow(dateISO: string, startTime: string, endTime: string) {
  const start = parseIstanbul(dateISO, startTime);
  const overnight = endTime <= startTime;
  const end = overnight
    ? parseIstanbul(addDaysISO(dateISO, 1), endTime)
    : parseIstanbul(dateISO, endTime);
  return { start, end, overnight };
}

export function formatDateTr(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00+03:00`);
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeZone: TZ,
  }).format(d);
}

export function formatTimeTr(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

export function formatDateTimeTr(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

export function formatMinutes(total: number): string {
  const abs = Math.max(0, Math.round(total));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h <= 0) return `${m} dk`;
  return `${h} sa ${m.toString().padStart(2, "0")} dk`;
}

export function weekdayName(n: number): string {
  return ["", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][n] ?? "";
}

export function greeting(date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date),
  );
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

export function recentWeekdays(count = 5, from = new Date()): string[] {
  const days: string[] = [];
  let cursor = todayISO(from);
  while (days.length < count) {
    const d = new Date(`${cursor}T12:00:00+03:00`);
    const wd = isoWeekday(d);
    if (wd <= 5) days.push(cursor);
    cursor = addDaysISO(cursor, -1);
  }
  return days.reverse();
}
