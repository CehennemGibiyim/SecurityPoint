// Referans projedeki ui/duty-conflict-utils.js bire bir portu:
// aynı-gün çift atama + saat çakışması + 11 saat dinlenme kontrolleri.
import type { ShiftSchedule } from "@/lib/shared";

export const REST_HOURS = 11;

type Window = { start: number; end: number; day: number };

function parseWindow(date: string, start?: string | null, end?: string | null): Window | null {
  const day = Number(date.slice(8, 10));
  if (!Number.isInteger(day)) return null;
  if (!start || !end) return { start: day * 24, end: day * 24 + 8, day };
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(n => !Number.isFinite(n))) return null;
  const s = day * 24 + sh + sm / 60;
  let e = day * 24 + eh + em / 60;
  if (e <= s) e += 24;
  return { start: s, end: e, day };
}

function recordLabel(s: ShiftSchedule) {
  const d = Number(s.scheduleDate.slice(8, 10));
  return `${d}. gün ${s.startTime ?? ""}–${s.endTime ?? ""} vardiyası`.trim();
}

export type DutyWarning = { type: "overlap" | "rest"; hours?: number; label: string };

export function getDutyWarnings(
  candidate: { personnelId: string; scheduleDate: string; startTime?: string | null; endTime?: string | null; columnKey?: string | null; id?: string },
  records: ShiftSchedule[],
): DutyWarning[] {
  const person = candidate.personnelId;
  if (!person) return [];
  const cw = parseWindow(candidate.scheduleDate, candidate.startTime, candidate.endTime);
  if (!cw) return [];
  const comparable = records
    .filter(r => r.personnelId === person)
    .filter(r => {
      if (candidate.id && r.id === candidate.id) return false;
      return !(String(r.columnKey ?? "") === String(candidate.columnKey ?? "") && r.scheduleDate === candidate.scheduleDate);
    })
    .map(r => ({ r, w: parseWindow(r.scheduleDate, r.startTime, r.endTime) }))
    .filter(x => x.w) as { r: ShiftSchedule; w: Window }[];

  const warnings: DutyWarning[] = [];
  comparable.forEach(({ r, w }) => {
    const overlaps = cw.start < w.end && w.start < cw.end;
    const sameDay = r.scheduleDate === candidate.scheduleDate;
    if (overlaps || sameDay) {
      warnings.push({ type: "overlap", label: recordLabel(r) });
      return;
    }
    const gapBefore = cw.start - w.end;
    const gapAfter = w.start - cw.end;
    if (gapBefore >= 0 && gapBefore < REST_HOURS) {
      warnings.push({ type: "rest", hours: Math.round(gapBefore * 10) / 10, label: recordLabel(r) });
    } else if (gapAfter >= 0 && gapAfter < REST_HOURS) {
      warnings.push({ type: "rest", hours: Math.round(gapAfter * 10) / 10, label: recordLabel(r) });
    }
  });
  return warnings.filter((w, i, list) => list.findIndex(x => x.type === w.type && x.label === w.label) === i);
}

export type DutyWarningEntry = {
  key: string; personnelId: string; day: number; warning: DutyWarning;
};

export function getDutyWarningSummary(records: ShiftSchedule[]): DutyWarningEntry[] {
  const summary: DutyWarningEntry[] = [];
  records.forEach(r => {
    getDutyWarnings(r, records).forEach(warning => {
      const key = `${r.personnelId}|${warning.type}|${r.scheduleDate}|${warning.label}`;
      if (summary.some(s => s.key === key)) return;
      summary.push({ key, personnelId: r.personnelId, day: Number(r.scheduleDate.slice(8, 10)), warning });
    });
  });
  return summary;
}

export function warningText(entry: DutyWarningEntry, personName: string, year: number, month: number): string {
  const date = `${entry.day}.${String(month + 1).padStart(2, "0")}.${year}`;
  if (entry.warning.type === "overlap") {
    return `${personName} — ${date} tarihinde başka bir vardiyayla çakışıyor (${entry.warning.label}).`;
  }
  return `${personName} — ${date} öncesi/sonrası yalnızca ${entry.warning.hours} saat dinlenme (${entry.warning.label}).`;
}

export function isWarningFor(
  candidate: { personnelId: string; scheduleDate: string; startTime?: string | null; endTime?: string | null; columnKey?: string | null; id?: string },
  records: ShiftSchedule[],
): boolean {
  return getDutyWarnings(candidate, records).length > 0;
}
