import type { Booking } from './types';

// ---------------- Dashboard chart math (dependency-free) ----------------
// Ported 1:1 from the vanilla panel.

export interface Month {
  key: string;
  label: string;
}

export function monthSeries(n: number): Month[] {
  const out: Month[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
    });
  }
  return out;
}

function bucketKey(dateLike: string | number | Date | undefined): string {
  const d = new Date(dateLike ?? Date.now());
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function revByMonth(bookings: Booking[], months: Month[]): number[] {
  const map: Record<string, number> = {};
  months.forEach((m) => {
    map[m.key] = 0;
  });
  bookings.forEach((b) => {
    if (!['ongoing', 'completed'].includes(b.status)) return;
    const k = bucketKey(b.createdAt || b.start);
    if (k in map) map[k] += (b.fare && b.fare.base) || 0;
  });
  return months.map((m) => map[m.key]);
}

export function countByMonth(bookings: Booking[], months: Month[]): number[] {
  const map: Record<string, number> = {};
  months.forEach((m) => {
    map[m.key] = 0;
  });
  bookings.forEach((b) => {
    const k = bucketKey(b.createdAt || b.start);
    if (k in map) map[k] += 1;
  });
  return months.map((m) => map[m.key]);
}

export function delta(series: number[]): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  if (!prev) return last ? 100 : 0;
  return Math.round(((last - prev) / prev) * 100);
}

export interface Pt {
  x: number;
  y: number;
}

export function smoothPath(pts: Pt[]): string {
  if (!pts.length) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}
