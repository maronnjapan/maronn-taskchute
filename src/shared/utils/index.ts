import { v7 as uuidv7 } from 'uuid';

/**
 * Generate a UUID v7 (time-ordered)
 */
export function generateId(): string {
  return uuidv7();
}

/**
 * Generate a random share token
 */
export function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get current Unix timestamp in seconds
 */
export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Convert Date to Unix timestamp in seconds
 */
export function dateToUnix(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert Unix timestamp to Date
 */
export function unixToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayString(): string {
  return formatDateString(new Date());
}

/**
 * Format minutes to readable string (e.g., "1時間30分")
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 0) return '0分';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}分`;
  }
  if (mins === 0) {
    return `${hours}時間`;
  }
  return `${hours}時間${mins}分`;
}

/**
 * Format Unix timestamp to locale string
 */
export function formatTimestamp(timestamp: number): string {
  return unixToDate(timestamp).toLocaleString('ja-JP');
}

/**
 * Check if a date string is valid YYYY-MM-DD format
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Add days to a date string
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return formatDateString(date);
}
