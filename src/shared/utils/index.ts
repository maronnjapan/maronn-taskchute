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
 * Format Unix timestamp to time only (HH:MM)
 */
export function formatTime(timestamp: number): string {
  const date = unixToDate(timestamp);
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format Unix timestamp to date and time (MM/DD HH:MM)
 */
export function formatDateTime(timestamp: number): string {
  const date = unixToDate(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return `${month}/${day} ${time}`;
}

/**
 * Parse time string (HH:MM) and create Unix timestamp for today
 */
export function parseTimeToUnix(timeString: string, baseDate?: Date): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = baseDate ? new Date(baseDate) : new Date();
  date.setHours(hours, minutes, 0, 0);
  return dateToUnix(date);
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

/**
 * Generate a PKCE code verifier (random string 43-128 characters)
 * Uses unreserved characters: A-Z, a-z, 0-9, -, ., _, ~
 */
export function generateCodeVerifier(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const length = 128; // Maximum length for security
  let result = '';

  // Use crypto.getRandomValues for cryptographically secure random values
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomValues[i] % chars.length);
  }

  return result;
}

/**
 * Generate a PKCE code challenge from a code verifier
 * code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  // Convert verifier to ArrayBuffer
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);

  // Hash with SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to Base64URL
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64 = btoa(String.fromCharCode(...hashArray));

  // Convert Base64 to Base64URL
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
