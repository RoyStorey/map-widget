/**
 * Time model: all scenario time values are "decimal years" using astronomical
 * year numbering (year 0 = 1 BCE, -1 = 2 BCE). 2024.5 is roughly July 2nd 2024.
 * This handles deep history (BCE), modern dates and sub-day precision uniformly.
 */

const MS_PER_DAY = 86400000;

function yearStartMs(year: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, 0, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export function decimalYearToDate(t: number): Date {
  const y = Math.floor(t);
  const s = yearStartMs(y);
  const e = yearStartMs(y + 1);
  return new Date(s + (t - y) * (e - s));
}

export function dateToDecimalYear(d: Date): number {
  const y = d.getUTCFullYear();
  const s = yearStartMs(y);
  const e = yearStartMs(y + 1);
  return y + (d.getTime() - s) / (e - s);
}

export function nowDecimalYear(): number {
  return dateToDecimalYear(new Date());
}

/** Years per day, roughly – handy for converting speeds. */
export const YEARS_PER_DAY = 1 / 365.2425;
export const DAYS_PER_YEAR = 365.2425;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatYear(y: number): string {
  if (y <= 0) return `${1 - y} BCE`;
  if (y < 1000) return `${y} CE`;
  return `${y}`;
}

export type Precision = 'year' | 'month' | 'day' | 'hour' | 'minute';

/** Pick a display precision appropriate for a time span (in years). */
export function precisionForSpan(spanYears: number): Precision {
  if (spanYears > 30) return 'year';
  if (spanYears > 2) return 'month';
  if (spanYears > 10 / 365) return 'day';
  if (spanYears > 0.5 / 365) return 'hour';
  return 'minute';
}

export function formatTime(t: number, precision: Precision = 'year'): string {
  if (!Number.isFinite(t)) return '—';
  if (precision === 'year') return formatYear(Math.floor(t));
  const d = decimalYearToDate(t);
  const y = d.getUTCFullYear();
  const yStr = formatYear(y);
  const m = MONTHS[d.getUTCMonth()];
  if (precision === 'month') return `${m} ${yStr}`;
  const day = d.getUTCDate();
  if (precision === 'day') return `${day} ${m} ${yStr}`;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day} ${m} ${yStr} ${hh}:${mm}`;
}

/**
 * Parse a user supplied time. Accepts:
 *  - numbers / numeric strings ("1219", "1219.5", "-500")
 *  - "500 BCE", "500 BC", "1066 CE", "AD 800"
 *  - ISO dates "2024-03-15", "2024-03-15T10:30"
 *  - "Mar 1241", "15 Mar 1241"
 */
export function parseTime(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  const s = input.trim();
  if (!s) return null;
  if (/^[-+]?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  let m = s.match(/^(\d+)\s*(BCE|BC|B\.C\.E?\.?)$/i);
  if (m) return 1 - parseInt(m[1], 10);
  m = s.match(/^(?:(\d+)\s*(?:CE|AD|A\.D\.)|(?:AD|CE)\s*(\d+))$/i);
  if (m) return parseInt(m[1] ?? m[2], 10);
  m = s.match(/^(-?\d{1,6})-(\d{1,2})(?:-(\d{1,2}))?(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?Z?$/);
  if (m) {
    const d = new Date(0);
    d.setUTCFullYear(parseInt(m[1], 10), parseInt(m[2], 10) - 1, m[3] ? parseInt(m[3], 10) : 1);
    d.setUTCHours(m[4] ? parseInt(m[4], 10) : 0, m[5] ? parseInt(m[5], 10) : 0, m[6] ? parseInt(m[6], 10) : 0, 0);
    return dateToDecimalYear(d);
  }
  m = s.match(/^(?:(\d{1,2})\s+)?([A-Za-z]{3})[a-z]*\.?\s+(-?\d+)\s*(BCE|BC)?$/i);
  if (m) {
    const mi = MONTHS.findIndex((x) => x.toLowerCase() === m![2].toLowerCase());
    if (mi >= 0) {
      let y = parseInt(m[3], 10);
      if (m[4]) y = 1 - y;
      const d = new Date(0);
      d.setUTCFullYear(y, mi, m[1] ? parseInt(m[1], 10) : 1);
      d.setUTCHours(0, 0, 0, 0);
      return dateToDecimalYear(d);
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return dateToDecimalYear(d);
  return null;
}

/** Nice tick step (in years) for a timeline of a given span and pixel width. */
export function niceTimeStep(spanYears: number, widthPx: number, minPx = 80): number {
  const target = (spanYears * minPx) / Math.max(1, widthPx);
  const candidates = [
    1 / (365.2425 * 24), 6 / (365.2425 * 24), 1 / 365.2425, 7 / 365.2425, 1 / 12, 3 / 12, 0.5,
    1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 100000,
  ];
  for (const c of candidates) if (c >= target) return c;
  return candidates[candidates.length - 1];
}

export function formatDuration(years: number): string {
  const a = Math.abs(years);
  if (a >= 1) return `${+a.toFixed(a < 10 ? 2 : 0)} yr`;
  const days = a * DAYS_PER_YEAR;
  if (days >= 1) return `${+days.toFixed(days < 10 ? 1 : 0)} d`;
  const hours = days * 24;
  if (hours >= 1) return `${+hours.toFixed(1)} h`;
  return `${+(hours * 60).toFixed(1)} min`;
}

export { MS_PER_DAY };
