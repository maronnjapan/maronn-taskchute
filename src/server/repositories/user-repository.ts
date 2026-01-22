import type { D1Database } from '@cloudflare/workers-types';
import type { User } from '../../shared/types/index';
import { generateId, nowUnix } from '../../shared/utils/index';

interface UserRow {
  id: string;
  auth0_id: string;
  email: string;
  name: string;
  created_at: number;
  updated_at: number;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    auth0Id: row.auth0_id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first<UserRow>();

    return row ? rowToUser(row) : null;
  }

  async findByAuth0Id(auth0Id: string): Promise<User | null> {
    const row = await this.db
      .prepare('SELECT * FROM users WHERE auth0_id = ?')
      .bind(auth0Id)
      .first<UserRow>();

    return row ? rowToUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first<UserRow>();

    return row ? rowToUser(row) : null;
  }

  async create(input: { auth0Id: string; email: string; name: string }): Promise<User> {
    const id = generateId();
    const now = nowUnix();

    await this.db
      .prepare(
        'INSERT INTO users (id, auth0_id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(id, input.auth0Id, input.email, input.name, now, now)
      .run();

    return {
      id,
      auth0Id: input.auth0Id,
      email: input.email,
      name: input.name,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(id: string, input: { email?: string; name?: string }): Promise<User | null> {
    const user = await this.findById(id);
    if (!user) return null;

    const now = nowUnix();
    const updates: string[] = ['updated_at = ?'];
    const values: (string | number)[] = [now];

    if (input.email !== undefined) {
      updates.push('email = ?');
      values.push(input.email);
    }
    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }

    values.push(id);

    await this.db
      .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return this.findById(id);
  }

  async upsertFromAuth0(auth0Id: string, email: string, name: string): Promise<User> {
    const existing = await this.findByAuth0Id(auth0Id);
    if (existing) {
      return (await this.update(existing.id, { email, name })) ?? existing;
    }
    return this.create({ auth0Id, email, name });
  }
}
