/**
 * Timezone utility functions for consistent Singapore timezone handling
 */

export const SINGAPORE_TIMEZONE = 'Asia/Singapore';

/**
 * Get current date and time in Singapore timezone
 * @returns Date object representing current time in Singapore
 */
export function getSingaporeNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: SINGAPORE_TIMEZONE }));
}

/**
 * Format a date to Singapore timezone string
 * @param date - Date to format
 * @returns Formatted date string in Singapore timezone
 */
export function toSingaporeString(date: Date): string {
  return date.toLocaleString('en-US', { timeZone: SINGAPORE_TIMEZONE });
}

/**
 * Format a date to Singapore timezone with custom options
 * @param date - Date to format
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string in Singapore timezone
 */
export function formatSingaporeDate(
  date: Date,
  options: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleString('en-US', {
    ...options,
    timeZone: SINGAPORE_TIMEZONE
  });
}
