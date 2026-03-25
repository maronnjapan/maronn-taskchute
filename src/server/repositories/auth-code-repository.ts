import type { D1Database } from '@cloudflare/workers-types';
import { generateId, nowUnix } from '../../shared/utils/index';

const AUTH_CODE_MAX_AGE_SECONDS = 300; // 5 minutes

export class AuthCodeRepository {
  constructor(private db: D1Database) {}

  async create(sessionId: string, verifier: string): Promise<{ code: string; verifier: string }> {
    const code = generateId();
    const now = nowUnix();

    await this.db
      .prepare('INSERT INTO auth_codes (code, session_id, verifier, created_at) VALUES (?, ?, ?, ?)')
      .bind(code, sessionId, verifier, now)
      .run();

    return { code, verifier };
  }

  async exchange(code: string, verifier: string): Promise<string | null> {
    const now = nowUnix();
    const minCreatedAt = now - AUTH_CODE_MAX_AGE_SECONDS;

    const result = await this.db
      .prepare('DELETE FROM auth_codes WHERE code = ? AND verifier = ? AND created_at > ? RETURNING session_id')
      .bind(code, verifier, minCreatedAt)
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
