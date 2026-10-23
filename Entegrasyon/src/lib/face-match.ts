export const MATCH_THRESHOLD = 0.52;

export function euclidean(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function averageDescriptors(list: number[][]): number[] {
  if (list.length === 0) return [];
  const dim = list[0].length;
  const out = new Array<number>(dim).fill(0);
  for (const item of list) {
    for (let i = 0; i < dim; i += 1) out[i] += item[i] ?? 0;
  }
  return out.map((value) => value / list.length);
}

export function confidenceFromDistance(distance: number): number {
  return Math.max(0, Math.min(1, (MATCH_THRESHOLD - distance) / MATCH_THRESHOLD));
}

export function isValidDescriptor(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= 128 && value.every((n) => typeof n === "number" && Number.isFinite(n));
}
