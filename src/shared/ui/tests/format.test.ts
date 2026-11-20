import { describe, expect, it } from 'vitest';
import { count, dateLong, dateShort, dateText, dateTimeShort, dayWib, initials, timeShort } from '../format';

// 2026-08-16T20:30:00Z is 17 August 2026, 03.30 in Jakarta.
const AT = Date.UTC(2026, 7, 16, 20, 30);

describe('Indonesian date formatting', () => {
  it('reads timestamps in Jakarta time', () => {
    expect(dayWib(AT)).toBe('2026-08-17');
    expect(timeShort(AT)).toBe('03.30');
    expect(dateText(AT)).toBe('17 Agustus 2026');
    expect(dateShort(AT)).toBe('17 Agu 2026');
    expect(dateTimeShort(AT)).toBe('17 Agu 2026, 03.30');
  });

  it('spells out day and month names for calendar dates', () => {
    expect(dateLong('2026-08-17')).toBe('Senin, 17 Agustus 2026');
    expect(dateText('2026-01-01')).toBe('1 Januari 2026');
  });

  it('groups thousands the Indonesian way', () => {
    expect(count(1250, 'pendaftar')).toBe('1.250 pendaftar');
  });

  it('makes avatar initials from the first and last name', () => {
    expect(initials('Siti Nur Aisyah')).toBe('SA');
    expect(initials('  budi ')).toBe('B');
    expect(initials('')).toBe('?');
  });
});
