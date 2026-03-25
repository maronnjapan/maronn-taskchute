import type { D1Database } from '@cloudflare/workers-types';
import { generateId, nowUnix } from '../../shared/utils/index';

const AUTH_CODE_MAX_AGE_SECONDS = 300; // 5 minutes

export class AuthCodeRepository {
  constructor(private db: D1Database) {}

  async create(sessionId: string): Promise<string> {
    const code = generateId();
    const now = nowUnix();

    await this.db
      .prepare('INSERT INTO auth_codes (code, session_id, created_at) VALUES (?, ?, ?)')
      .bind(code, sessionId, now)
      .run();

    return code;
  }

  async exchange(code: string): Promise<string | null> {
    const now = nowUnix();
    const minCreatedAt = now - AUTH_CODE_MAX_AGE_SECONDS;

    const result = await this.db
      .prepare('DELETE FROM auth_codes WHERE code = ? AND created_at > ? RETURNING session_id')
      .bind(code, minCreatedAt)
      .first<{ session_id: string }>();

    return result?.session_id ?? null;
  }

  async deleteExpired(): Promise<number> {
    const now = nowUnix();
    const minCreatedAt = now - AUTH_CODE_MAX_AGE_SECONDS;

    const result = await this.db
      .prepare('DELETE FROM auth_codes WHERE created_at < ?')
      .bind(minCreatedAt)
      .run();

    return result.meta?.changes ?? 0;
  }
}
