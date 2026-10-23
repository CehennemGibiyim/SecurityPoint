// Kaynak projedeki src/lib/puantaj-engine.ts bire bir taşındı.
export type PujantajCode = 'G' | 'G2' | 'N' | 'N2' | 'B' | 'B2' | 'NB' | 'İ' | 'R' | 'ÜY' | '';

export const SHIFT_HOURS: Record<string, number> = {
  G: 8, G2: 12, N: 8, N2: 12, B: 8, B2: 12, NB: 0, 'İ': 0, R: 0, ÜY: 0, '': 0,
};

export const SHIFT_NET_HOURS: Record<string, number> = {
  G: 7.5, G2: 11, N: 7.5, N2: 11, B: 7.5, B2: 11, NB: 0, 'İ': 0, R: 0, ÜY: 0, '': 0,
};

export const NIGHT_SHIFTS: Record<string, number> = {
  G: 0, G2: 0, N: 7.5, N2: 11, B: 0, B2: 0, NB: 0, 'İ': 0, R: 0, ÜY: 0, '': 0,
};

export const EXTRA_SHIFTS: Record<string, number> = {
  G: 0, G2: 3.5, N: 0, N2: 3.5, B: 0, B2: 3.5, NB: 0, 'İ': 0, R: 0, ÜY: 0, '': 0,
};

export const HOLIDAY_SHIFTS: Record<string, number> = {
  G: 0, G2: 0, N: 0, N2: 0, B: 7.5, B2: 11, NB: 0, 'İ': 0, R: 0, ÜY: 0, '': 0,
};

const ALIASES: Record<string, string> = {
  GÜNDÜZ: 'G', GUNDUZ: 'G', GECE: 'N', BAYRAM: 'B', NÖBET: 'NB', NOBET: 'NB',
  İZİN: 'İ', IZIN: 'İ', RAPOR: 'R', ÜCRETSİZ: 'ÜY', UCRETSIZ: 'ÜY',
};

export function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeShiftCode(value: string | null | undefined): string {
  const raw = String(value ?? '').trim().toUpperCase();
  return ALIASES[raw] || raw;
}

/**
 * Net çalışma saati — İş Kanunu m.68 ara dinlenme kuralı (kurum uygulaması):
 *
 *   Brüt ≤ 7,5 saat   → kesinti yok (kısa vardiya / net girilmiş saat)
 *   7,5 < brüt ≤ 8    → 7,5 saat          (30 dk ara dinlenme)
 *   8 < brüt ≤ 12     → brüt − 1 saat     (9→8 · 10→9 · 11→10 · 12→11)
 *   brüt > 12         → brüt − 1,5 saat   (13→11,5 · 16→14,5 · 24→22,5)
 *
 * Sonuç hiçbir zaman bir alt kademenin altına düşmez (ör. 8,5 saat → 7,5),
 * böylece fazla çalışma daha az net saat üretmez.
 */
export function getNetWorkedHours(grossHours: number) {
  const gross = Number(grossHours);
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  let net: number;
  if (gross <= 7.5) net = gross;
  else if (gross <= 8) net = 7.5;
  else if (gross <= 12) net = Math.max(7.5, gross - 1);
  else net = Math.max(11, gross - 1.5);
  return roundHours(net);
}

/** Düşülen ara dinlenme süresi (brüt − net). */
export function getBreakHours(grossHours: number) {
  const gross = Number(grossHours);
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  return roundHours(gross - getNetWorkedHours(gross));
}

export function isKnownCode(value: string) {
  return Object.prototype.hasOwnProperty.call(SHIFT_NET_HOURS, normalizeShiftCode(value));
}

export function getShiftMetrics(value: string | number | null | undefined, isHoliday: boolean) {
  const raw = String(value ?? '').trim();
  const code = normalizeShiftCode(raw);
  const numeric = /^\d+(?:[.,]\d+)?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN;
  const worked = Number.isFinite(numeric) ? getNetWorkedHours(numeric) : (SHIFT_NET_HOURS[code] || 0);
  const extra = Number.isFinite(numeric) ? Math.max(0, worked - 7.5) : (EXTRA_SHIFTS[code] || 0);
  const holiday = isHoliday && worked > 0 ? worked : (HOLIDAY_SHIFTS[code] || 0);
  return {
    code,
    gross: Number.isFinite(numeric) ? roundHours(numeric) : (SHIFT_HOURS[code] || 0),
    worked: roundHours(worked),
    night: roundHours(NIGHT_SHIFTS[code] || 0),
    extra: roundHours(extra),
    holiday: roundHours(holiday),
  };
}

export function parseShiftRange(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let gross = (eh + em / 60) - (sh + sm / 60);
  if (gross <= 0) gross += 24;
  return roundHours(gross);
}

export function getShiftRangeMetrics(start?: string | null, end?: string | null, holiday = false) {
  const gross = parseShiftRange(start, end);
  const overnight = Boolean(start && end && (() => {
    const sh = Number(start.split(':')[0]);
    const eh = Number(end.split(':')[0]);
    return eh <= sh || sh >= 18 || eh <= 6;
  })());
  const worked = getNetWorkedHours(gross);
  return {
    gross,
    worked,
    night: overnight ? worked : 0,
    extra: Math.max(0, worked - 7.5),
    holiday: holiday ? worked : 0,
  };
}
