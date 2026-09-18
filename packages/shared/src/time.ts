/**
 * Zaman yardimcilari.
 *
 * Sistem icinde tum zaman damgalari UTC tutulur; raporlama/hakedis gun
 * siniri sirket saat diliminde (varsayilan Europe/Istanbul) hesaplanir.
 * Puantaj ve gunluk hakedis "gun" tanimi buradan gelir.
 */

export const DEFAULT_TIMEZONE = 'Europe/Istanbul';

const offsetFormatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = offsetFormatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    offsetFormatterCache.set(timeZone, fmt);
  }
  return fmt;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, timeZone: string = DEFAULT_TIMEZONE): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type);
    return found ? Number(found.value) : 0;
  };
  const hour = get('hour');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: hour === 24 ? 0 : hour,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Verilen anin saat diliminden UTC ofseti (dakika). Turkiye icin +180. */
export function timezoneOffsetMinutes(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** YYYY-MM-DD formatinda yerel gun anahtari (puantaj/hakedis gunu). */
export function localDateKey(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Yerel gun basi (00:00) - UTC Date olarak. */
export function startOfLocalDay(date: Date, timeZone: string = DEFAULT_TIMEZONE): Date {
  const p = zonedParts(date, timeZone);
  const guess = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  const offset = timezoneOffsetMinutes(new Date(guess), timeZone);
  return new Date(guess - offset * 60_000);
}

/** Yerel gun sonu (ertesi gun 00:00). */
export function endOfLocalDay(date: Date, timeZone: string = DEFAULT_TIMEZONE): Date {
  const start = startOfLocalDay(date, timeZone);
  return startOfLocalDay(new Date(start.getTime() + 36 * 3600_000), timeZone);
}

/** "YYYY-MM-DD" gun anahtarindan [baslangic, bitis) UTC araligi. */
export function localDayRange(dateKey: string, timeZone: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Gecersiz gun anahtari: ${dateKey}`);
  const guess = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const start = startOfLocalDay(guess, timeZone);
  return { start, end: endOfLocalDay(start, timeZone) };
}

/** Yerel gun icindeki dakika (00:00'dan itibaren) - vardiya/mola pencereleri icin. */
export function minutesIntoLocalDay(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const p = zonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

/** ISO haftanin gunu: 1 = Pazartesi ... 7 = Pazar (yerel saatte). */
export function localIsoWeekday(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const p = zonedParts(date, timeZone);
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Saniyeyi "7s 32d" gibi insan okunur metne cevirir. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0 && m === 0) return `${total % 60}sn`;
  if (h === 0) return `${m}d`;
  return `${h}s ${String(m).padStart(2, '0')}d`;
}

/** Saniyeyi ondalik saate cevirir (hakedis hesabinda kullanilir). */
export function secondsToHours(seconds: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round((seconds / 3600) * factor) / factor;
}

export function clampDate(value: Date, min: Date, max: Date): Date {
  if (value.getTime() < min.getTime()) return min;
  if (value.getTime() > max.getTime()) return max;
  return value;
}

/** [aStart, aEnd) ile [bStart, bEnd) araliklarinin kesisimi (saniye). */
export function overlapSeconds(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return end <= start ? 0 : (end - start) / 1000;
}
