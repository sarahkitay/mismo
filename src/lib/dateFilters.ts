export type DateRangePreset = 'ALL' | '7D' | '30D' | '90D' | '1Y' | 'CUSTOM';

export interface DateRangeState {
  preset: DateRangePreset;
  startDate?: string;
  endDate?: string;
}

export const defaultDateRange: DateRangeState = { preset: 'ALL' };

/** Normalize to timestamp (ms); accepts Date or ISO date string. Returns NaN if invalid. */
function toTimestamp(date: Date | string): number {
  const value = typeof date === 'string' ? new Date(date) : date;
  return value instanceof Date ? value.getTime() : NaN;
}

export function inDateRange(date: Date | string, range: DateRangeState): boolean {
  if (range.preset === 'ALL') return true;
  const d = toTimestamp(date);
  if (Number.isNaN(d)) return false;

  const now = new Date();
  const nowMs = now.getTime();

  if (range.preset === 'CUSTOM') {
    const start = range.startDate ? new Date(range.startDate).getTime() : Number.NEGATIVE_INFINITY;
    const end = range.endDate ? new Date(range.endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Number.POSITIVE_INFINITY;
    return d >= start && d <= end;
  }

  const days =
    range.preset === '7D' ? 7 :
    range.preset === '30D' ? 30 :
    range.preset === '90D' ? 90 : 365;
  const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
  return d >= cutoff;
}
