/**
 * Kapı terminali çevrimdışı tamponu (ağ kesintisi protokolü).
 *
 * Ağ varken: kapı ve yetki listesi anlık görüntü olarak saklanır.
 * Ağ kesilirse: terminal son bilinen yetki listesiyle sicil geçişini
 * değerlendirir, olayı kuyruğa alır; bağlantı geri gelince kuyruk
 * `/api/offline-queue` ucuna boşaltılır ve sunucu logları tamamlanır.
 */
import { isoWeekday, timeHHmm } from "@/lib/time";

const DOORS_KEY = "p26:terminal:doors";
const PERMS_KEY = "p26:terminal:perms";
const QUEUE_KEY = "p26:terminal:queue";

export type CachedPermission = {
  employeeId: number;
  employeeNo: string | null;
  employeeName: string;
  doorId: number;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
};

export type QueuedEvent = { doorId: number; body: Record<string, unknown>; at: string };

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* gizli mod / kota dolu — sessiz geç */
  }
}

export function cacheDoorsSnapshot(doors: unknown[]) {
  write(DOORS_KEY, { at: new Date().toISOString(), doors });
}

export function readDoorsSnapshot(): { at: string; doors: unknown[] } | null {
  return read<{ at: string; doors: unknown[] }>(DOORS_KEY);
}

export function cachePermissionsSnapshot(perms: CachedPermission[]) {
  write(PERMS_KEY, { at: new Date().toISOString(), perms });
}

export function readPermissionsSnapshot(): { at: string; perms: CachedPermission[] } | null {
  return read<{ at: string; perms: CachedPermission[] }>(PERMS_KEY);
}

export function queueEvent(doorId: number, body: Record<string, unknown>): number {
  const queue = read<QueuedEvent[]>(QUEUE_KEY) ?? [];
  queue.push({ doorId, body, at: new Date().toISOString() });
  // Kuyruğu sınırla (son200 olay) — taşanlar bilgi kaybıdır, denge budur
  const trimmed = queue.slice(-200);
  write(QUEUE_KEY, trimmed);
  return trimmed.length;
}

export function pendingCount(): number {
  return (read<QueuedEvent[]>(QUEUE_KEY) ?? []).length;
}

/**
 * Bağlantı geldiğinde kuyruğu sunucuya boşaltır.
 * Başarılı gönderimler düşer; yarım kalanlar bir sonraki denemede tekrar gider.
 */
export async function flushQueue(): Promise<number> {
  const queue = read<QueuedEvent[]>(QUEUE_KEY) ?? [];
  if (!queue.length) return 0;
  const remaining: QueuedEvent[] = [];
  let synced = 0;
  for (const item of queue) {
    try {
      const res = await fetch("/api/offline-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doorId: item.doorId, payload: { ...item.body, queuedAt: item.at, source: "terminal-offline" } }),
      });
      if (res.ok) synced++;
      else remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }
  write(QUEUE_KEY, remaining);
  return synced;
}

function normalizeNo(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Son bilinen yetki listesiyle çevrimdışı sicil değerlendirmesi.
 * Sunucudaki `checkDoorPermission` mantığının istemci aynası:
 * gün kontrolü + saat penceresi (gece vardiyası dahil) + geçerlilik aralığı.
 */
export function offlineEvaluate(
  perms: CachedPermission[],
  employeeNo: string,
  doorId: number,
  now = new Date(),
): { ok: boolean; reason: string; employeeName: string | null } {
  const needle = normalizeNo(employeeNo);
  const digits = needle.replace(/\D/g, "");
  const mine = perms.filter((p) => {
    if (!p.isActive || p.doorId !== doorId || !p.employeeNo) return false;
    const no = normalizeNo(p.employeeNo);
    return no === needle || no.endsWith(needle) || (digits.length >= 3 && no.replace(/\D/g, "") === digits);
  });
  if (!mine.length) {
    return { ok: false, reason: "Çevrimdışı: bu kapıya tanımlı yetkiniz görünmüyor (son liste).", employeeName: null };
  }
  const weekday = isoWeekday(now);
  const clock = timeHHmm(now);
  const today = now.toISOString().slice(0, 10);
  for (const p of mine) {
    if (p.validFrom && today < p.validFrom) continue;
    if (p.validTo && today > p.validTo) continue;
    if (!p.daysOfWeek.includes(weekday)) continue;
    const overnight = p.endTime < p.startTime;
    const inWindow = overnight
      ? clock >= p.startTime || clock <= p.endTime
      : clock >= p.startTime && clock <= p.endTime;
    if (inWindow) {
      return { ok: true, reason: "Çevrimdışı yetki doğrulandı (son bilinen liste)", employeeName: p.employeeName };
    }
  }
  return { ok: false, reason: "Çevrimdışı: yetkiniz bugün / bu saatte geçerli değil (son liste).", employeeName: mine[0]?.employeeName ?? null };
}
