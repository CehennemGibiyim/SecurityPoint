// Kaynak projedeki WarningsPanel buildWarnings mantığının taşınması.
import type { Personnel, ShiftSchedule } from "@/lib/shared";
import { fmtTr } from "@/lib/shared";
import { getNetWorkedHours } from "@/lib/puantaj-engine";

export type WarningItem = {
  kind: 'REST' | 'CONSECUTIVE' | 'WEEKLY' | 'NIGHT';
  level: 'HIGH' | 'MED';
  personnelName: string;
  personnelId: string;
  text: string;
};

export const KIND_META: Record<WarningItem['kind'], { label: string; cls: string; dot: string }> = {
  REST:        { label: 'Dinlenme Süresi', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40', dot: 'bg-rose-400' },
  CONSECUTIVE: { label: 'Ardışık Nöbet',   cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40', dot: 'bg-amber-400' },
  WEEKLY:      { label: 'Haftalık Limit',  cls: 'bg-orange-500/15 text-orange-300 border-orange-500/40', dot: 'bg-orange-400' },
  NIGHT:       { label: 'Gece Çalışması',  cls: 'bg-violet-500/15 text-violet-300 border-violet-500/40', dot: 'bg-violet-400' },
};

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function interval(s: ShiftSchedule): { start: number; end: number } | null {
  if (!s.startTime || !s.endTime) return null;
  const base = Date.parse(`${s.scheduleDate}T00:00:00Z`) / 60000;
  const st = toMinutes(s.startTime);
  let en = toMinutes(s.endTime);
  if (en <= st) en += 24 * 60;
  return { start: base + st, end: base + en };
}
/**
 * Haftalık limit kontrolü için net saat — puantajla BİREBİR aynı kural
 * (İş Kanunu m.68: 8 saate kadar 7,5 · 8–12 saat arası 1 saat kesinti).
 * Memur/hemşire için limit brüt saat üzerinden değerlendirilir.
 */
function netHours(gross: number, isWorker: boolean) {
  if (!isWorker) return gross;
  return getNetWorkedHours(gross);
}
/** 20:00–06:00 arası gece süresi (İş Kanunu M.69). */
function nightMinutes(start: number, end: number) {
  let total = 0;
  for (let t = start; t < end; t++) {
    const minOfDay = ((t % 1440) + 1440) % 1440;
    if (minOfDay >= 20 * 60 || minOfDay < 6 * 60) total++;
  }
  return total;
}
/** Pazartesi başlangıçlı hafta anahtarı. */
function weekKey(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function buildWarnings(shifts: ShiftSchedule[], personnel: Personnel[]): WarningItem[] {
  const persMap = new Map(personnel.map(p => [p.id, p]));
  const byPerson = new Map<string, ShiftSchedule[]>();
  shifts.forEach(s => {
    if (!s.personnelId) return;
    const arr = byPerson.get(s.personnelId) || [];
    arr.push(s);
    byPerson.set(s.personnelId, arr);
  });

  const out: WarningItem[] = [];

  byPerson.forEach((list, pid) => {
    const p = persMap.get(pid);
    const name = p?.name || 'Personel';
    const isWorker = p?.personnelType === 'ISCI';
    const weeklyLimit = isWorker ? 45 : 40;

    const items = list
      .map(s => ({ s, iv: interval(s) }))
      .filter(x => x.iv)
      .sort((a, b) => a.iv!.start - b.iv!.start);

    // 1) Dinlenme süresi (ardışık iki vardiya arası en az 11 saat)
    for (let i = 1; i < items.length; i++) {
      const gap = (items[i].iv!.start - items[i - 1].iv!.end) / 60;
      if (gap < 11) {
        out.push({
          kind: 'REST', level: gap < 8 ? 'HIGH' : 'MED', personnelName: name, personnelId: pid,
          text: `${fmtTr(items[i - 1].s.scheduleDate)} → ${fmtTr(items[i].s.scheduleDate)} arası yalnızca ${gap.toFixed(1)} saat dinlenme (asgari 11 saat).`,
        });
      }
    }

    // 2) Ardışık nöbet (üst üste 3 gün ve fazlası)
    const days = Array.from(new Set(list.map(s => s.scheduleDate))).sort();
    let runStart = 0;
    for (let i = 1; i <= days.length; i++) {
      const consecutive = i < days.length &&
        (Date.parse(days[i] + 'T00:00:00Z') - Date.parse(days[i - 1] + 'T00:00:00Z')) === 86400000;
      if (!consecutive) {
        const len = i - runStart;
        if (len >= 3) {
          out.push({
            kind: 'CONSECUTIVE', level: len >= 5 ? 'HIGH' : 'MED', personnelName: name, personnelId: pid,
            text: `${fmtTr(days[runStart])} – ${fmtTr(days[i - 1])} arası ${len} gün ardışık nöbet (hafta tatili kullandırılmalı).`,
          });
        }
        runStart = i;
      }
    }

    // 3) Haftalık çalışma limiti (işçi 45 / memur 40 saat)
    const weekly = new Map<string, number>();
    items.forEach(({ s, iv }) => {
      const gross = (iv!.end - iv!.start) / 60;
      const net = netHours(gross, isWorker);
      const key = weekKey(s.scheduleDate);
      weekly.set(key, (weekly.get(key) || 0) + net);
    });
    weekly.forEach((hours, key) => {
      if (hours > weeklyLimit) {
        out.push({
          kind: 'WEEKLY', level: hours > weeklyLimit + 7.5 ? 'HIGH' : 'MED', personnelName: name, personnelId: pid,
          text: `${fmtTr(key)} haftasında ${hours.toFixed(1)} saat çalışma (limit ${weeklyLimit} saat).`,
        });
      }
    });

    // 4) Gece çalışması sınırı (gecede 7.5 saati aşan)
    items.forEach(({ s, iv }) => {
      const nm = nightMinutes(iv!.start, iv!.end) / 60;
      if (nm > 7.5) {
        out.push({
          kind: 'NIGHT', level: nm > 9 ? 'HIGH' : 'MED', personnelName: name, personnelId: pid,
          text: `${fmtTr(s.scheduleDate)} vardiyasında ${nm.toFixed(1)} saat gece çalışması (azami 7.5 saat önerilir).`,
        });
      }
    });
  });

  // Öncelik: HIGH önce, sonra personel adı
  return out.sort((a, b) =>
    (a.level === b.level ? a.personnelName.localeCompare(b.personnelName, 'tr') : a.level === 'HIGH' ? -1 : 1));
}
