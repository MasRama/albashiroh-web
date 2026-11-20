/**
 * Dates as Al Bashiroh shows them, in Indonesian and in Jakarta time (WIB).
 * Timestamps are milliseconds; calendar dates are `YYYY-MM-DD` strings. Day
 * and month names are spelled out here rather than taken from Intl, so a
 * browser with a thin locale table still writes "Senin" and "Agustus".
 */
const WIB_OFFSET_MS = 7 * 3_600_000;

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function parse(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

/** The calendar date in Jakarta at `at`. */
export function dayWib(at = Date.now()): string {
  return new Date(at + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** "Senin, 2 November 2026" for a `YYYY-MM-DD` date. */
export function dateLong(ymd: string): string {
  const date = parse(ymd);
  return `${DAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "2 November 2026" for a timestamp or a `YYYY-MM-DD` date. */
export function dateText(value: number | string): string {
  const date = parse(typeof value === 'number' ? dayWib(value) : value);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "2 Nov 2026" for a timestamp or a `YYYY-MM-DD` date. */
export function dateShort(value: number | string): string {
  const date = parse(typeof value === 'number' ? dayWib(value) : value);
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "09.12" in Jakarta time. */
export function timeShort(at: number): string {
  const shifted = new Date(at + WIB_OFFSET_MS);
  return `${String(shifted.getUTCHours()).padStart(2, '0')}.${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
}

/** "2 Nov 2026, 09.12" in Jakarta time. */
export function dateTimeShort(at: number): string {
  return `${dateShort(at)}, ${timeShort(at)}`;
}

/** A count with its noun: "1 berita", "12 berita" (Indonesian nouns do not change). */
export function count(value: number, noun: string): string {
  return `${new Intl.NumberFormat('id-ID').format(value)} ${noun}`;
}

/** The first letters of a name, for an avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase() || '?';
}
