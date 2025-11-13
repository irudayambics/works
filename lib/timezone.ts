import { DateTime } from 'luxon';

export const SG_TZ = 'Asia/Singapore' as const;

export function nowSg(): DateTime {
  return DateTime.now().setZone(SG_TZ);
}

export function getSingaporeNow(): DateTime {
  return nowSg();
}

export function toSg(input: string | number | Date): DateTime {
  return DateTime.fromJSDate(new Date(input)).setZone(SG_TZ);
}

export function parseSg(input: string): DateTime {
  const iso = DateTime.fromISO(input, { zone: SG_TZ });
  if (iso.isValid) {
    return iso;
  }

  return DateTime.fromFormat(input, "yyyy-MM-dd'T'HH:mm", { zone: SG_TZ });
}

export function startOfDaySg(input: string | Date): DateTime {
  return toSg(input).startOf('day');
}

export function endOfDaySg(input: string | Date): DateTime {
  return toSg(input).endOf('day');
}

export function toUtcIso(dt: DateTime): string {
  return dt.toUTC().toISO({ suppressMilliseconds: false }) ?? new Date().toISOString();
}

export function fromUtcIso(iso: string): DateTime {
  return DateTime.fromISO(iso).toUTC();
}

export function formatSingaporeDate(dt: DateTime, options?: Intl.DateTimeFormatOptions): string {
  return dt.setZone(SG_TZ).toLocaleString({
    ...options,
    timeZone: SG_TZ
  });
}
