// Session constants
export const SESSION_COOKIE_NAME = 'session_id';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

// Task constants
export const MAX_TASK_TITLE_LENGTH = 200;
export const MAX_TASK_DESCRIPTION_LENGTH = 10000;
export const MAX_MINUTES_PER_DAY = 1440; // 24 hours

// Workspace constants
export const MAX_WORKSPACE_NAME_LENGTH = 100;

// Sync constants
export const SYNC_POLL_INTERVAL_MS = 30000; // 30 seconds
export const SYNC_RETRY_DELAYS_MS = [2000, 4000, 8000, 16000]; // Exponential backoff

// Date formats
export const DATE_FORMAT = 'YYYY-MM-DD';

// API error codes
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFLICT: 'CONFLICT',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
