import { describe, expect, it } from 'vitest';
import { dateToDecimalYear, decimalYearToDate, formatTime, parseTime } from '../src/core/time';

describe('time', () => {
  it('parses years, BCE and ISO dates', () => {
    expect(parseTime('1066')).toBe(1066);
    expect(parseTime(-499)).toBe(-499);
    expect(parseTime('500 BCE')).toBe(-499);
    expect(parseTime('AD 800')).toBe(800);
    const t = parseTime('1944-06-06T06:30')!;
    expect(Math.floor(t)).toBe(1944);
    expect(formatTime(t, 'minute')).toBe('6 Jun 1944 06:30');
    expect(parseTime('Oct 1066')! - 1066).toBeCloseTo(273 / 365, 2);
    expect(parseTime('nonsense')).toBeNull();
  });
  it('round-trips decimal years and dates', () => {
    const d = new Date(Date.UTC(1815, 5, 18, 11, 30));
    expect(decimalYearToDate(dateToDecimalYear(d)).getTime()).toBeCloseTo(d.getTime(), -2);
  });
  it('formats BCE years', () => {
    expect(formatTime(-499)).toBe('500 BCE');
    expect(formatTime(800)).toBe('800 CE');
    expect(formatTime(1914)).toBe('1914');
  });
});
