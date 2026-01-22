import type { D1Database } from '@cloudflare/workers-types';
import type { Session } from '../../shared/types/index';
import { generateId, nowUnix } from '../../shared/utils/index';
import { SESSION_MAX_AGE_SECONDS } from '../../shared/constants/index';

interface SessionRow {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
  updated_at: number;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SessionRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<Session | null> {
    const row = await this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .bind(id)
      .first<SessionRow>();

    return row ? rowToSession(row) : null;
  }

  async findValidById(id: string): Promise<Session | null> {
    const now = nowUnix();
    const row = await this.db
      .prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?')
      .bind(id, now)
      .first<SessionRow>();

    return row ? rowToSession(row) : null;
  }

  async create(userId: string): Promise<Session> {
    const id = generateId();
    const now = nowUnix();
    const expiresAt = now + SESSION_MAX_AGE_SECONDS;

    await this.db
      .prepare(
        'INSERT INTO sessions (id, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(id, userId, expiresAt, now, now)
      .run();

    return {
      id,
      userId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    };
  }

  async refresh(id: string): Promise<Session | null> {
    const session = await this.findValidById(id);
    if (!session) return null;

    const now = nowUnix();
    const newExpiresAt = now + SESSION_MAX_AGE_SECONDS;

    await this.db
      .prepare('UPDATE sessions SET expires_at = ?, updated_at = ? WHERE id = ?')
      .bind(newExpiresAt, now, id)
      .run();

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM sessions WHERE id = ?')
      .bind(id)
      .run();

    return (result.meta?.changes ?? 0) > 0;
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.db
      .prepare('DELETE FROM sessions WHERE user_id = ?')
      .bind(userId)
      .run();

    return result.meta?.changes ?? 0;
  }

  async deleteExpired(): Promise<number> {
    const now = nowUnix();
    const result = await this.db
      .prepare('DELETE FROM sessions WHERE expires_at < ?')
      .bind(now)
      .run();

    return result.meta?.changes ?? 0;
  }
}
