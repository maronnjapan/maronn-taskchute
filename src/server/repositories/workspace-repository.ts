import type { D1Database } from '@cloudflare/workers-types';
import type { Workspace } from '../../shared/types/index';
import { generateId, generateShareToken, nowUnix } from '../../shared/utils/index';

interface WorkspaceRow {
  id: string;
  owner_id: string;
  share_token: string;
  name: string;
  created_at: number;
  updated_at: number;
}

function rowToWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    ownerId: row.owner_id,
    shareToken: row.share_token,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class WorkspaceRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<Workspace | null> {
    const row = await this.db
      .prepare('SELECT * FROM workspaces WHERE id = ?')
      .bind(id)
      .first<WorkspaceRow>();

    return row ? rowToWorkspace(row) : null;
  }

  async findByShareToken(shareToken: string): Promise<Workspace | null> {
    const row = await this.db
      .prepare('SELECT * FROM workspaces WHERE share_token = ?')
      .bind(shareToken)
      .first<WorkspaceRow>();

    return row ? rowToWorkspace(row) : null;
  }

  async findByOwnerId(ownerId: string): Promise<Workspace[]> {
    const result = await this.db
      .prepare('SELECT * FROM workspaces WHERE owner_id = ? ORDER BY created_at DESC')
      .bind(ownerId)
      .all<WorkspaceRow>();

    return (result.results ?? []).map(rowToWorkspace);
  }

  async create(input: { ownerId: string; name: string }): Promise<Workspace> {
    const id = generateId();
    const shareToken = generateShareToken();
    const now = nowUnix();

    await this.db
      .prepare(
        'INSERT INTO workspaces (id, owner_id, share_token, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(id, input.ownerId, shareToken, input.name, now, now)
      .run();

    return {
      id,
      ownerId: input.ownerId,
      shareToken,
      name: input.name,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(id: string, input: { name?: string }): Promise<Workspace | null> {
    const workspace = await this.findById(id);
    if (!workspace) return null;

    const now = nowUnix();
    const updates: string[] = ['updated_at = ?'];
    const values: (string | number)[] = [now];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }

    values.push(id);

    await this.db
      .prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return this.findById(id);
  }

  async regenerateShareToken(id: string): Promise<Workspace | null> {
    const workspace = await this.findById(id);
    if (!workspace) return null;

    const newToken = generateShareToken();
    const now = nowUnix();

    await this.db
      .prepare('UPDATE workspaces SET share_token = ?, updated_at = ? WHERE id = ?')
      .bind(newToken, now, id)
      .run();

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM workspaces WHERE id = ?')
      .bind(id)
      .run();

    return (result.meta?.changes ?? 0) > 0;
  }

  async isOwner(workspaceId: string, userId: string): Promise<boolean> {
    const workspace = await this.findById(workspaceId);
    return workspace?.ownerId === userId;
  }
}
