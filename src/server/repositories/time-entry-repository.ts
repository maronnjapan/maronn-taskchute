import type { D1Database } from '@cloudflare/workers-types';
import type { TimeEntry } from '../../shared/types/index';
import { generateId, nowUnix } from '../../shared/utils/index';

interface TimeEntryRow {
  id: string;
  task_id: string;
  started_at: number;
  ended_at: number | null;
  duration_minutes: number | null;
  created_at: number;
  updated_at: number;
}

function rowToTimeEntry(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TimeEntryRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<TimeEntry | null> {
    const row = await this.db
      .prepare('SELECT * FROM time_entries WHERE id = ?')
      .bind(id)
      .first<TimeEntryRow>();

    return row ? rowToTimeEntry(row) : null;
  }

  async findByTaskId(taskId: string): Promise<TimeEntry[]> {
    const result = await this.db
      .prepare('SELECT * FROM time_entries WHERE task_id = ? ORDER BY started_at DESC')
      .bind(taskId)
      .all<TimeEntryRow>();

    return (result.results ?? []).map(rowToTimeEntry);
  }

  async findActiveByTaskId(taskId: string): Promise<TimeEntry | null> {
    const row = await this.db
      .prepare('SELECT * FROM time_entries WHERE task_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1')
      .bind(taskId)
      .first<TimeEntryRow>();

    return row ? rowToTimeEntry(row) : null;
  }

  async findByTaskIds(taskIds: string[]): Promise<Map<string, TimeEntry[]>> {
    if (taskIds.length === 0) return new Map();

    const placeholders = taskIds.map(() => '?').join(',');
    const result = await this.db
      .prepare(`SELECT * FROM time_entries WHERE task_id IN (${placeholders}) ORDER BY started_at DESC`)
      .bind(...taskIds)
      .all<TimeEntryRow>();

    const entries = (result.results ?? []).map(rowToTimeEntry);
    const map = new Map<string, TimeEntry[]>();

    for (const entry of entries) {
      const existing = map.get(entry.taskId) ?? [];
      existing.push(entry);
      map.set(entry.taskId, existing);
    }

    return map;
  }

  async start(taskId: string): Promise<TimeEntry> {
    const id = generateId();
    const now = nowUnix();

    await this.db
      .prepare(
        `INSERT INTO time_entries (id, task_id, started_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, taskId, now, now, now)
      .run();

    return (await this.findById(id))!;
  }

  async stop(id: string): Promise<TimeEntry | null> {
    const entry = await this.findById(id);
    if (!entry || entry.endedAt) return entry;

    const now = nowUnix();
    const durationMinutes = Math.round((now - entry.startedAt) / 60);

    await this.db
      .prepare(
        `UPDATE time_entries SET ended_at = ?, duration_minutes = ?, updated_at = ? WHERE id = ?`
      )
      .bind(now, durationMinutes, now, id)
      .run();

    return this.findById(id);
  }

  async update(
    id: string,
    input: { startedAt?: number; endedAt?: number | null; durationMinutes?: number | null }
  ): Promise<TimeEntry | null> {
    const entry = await this.findById(id);
    if (!entry) return null;

    const now = nowUnix();
    const updates: string[] = [];
    const values: (number | null)[] = [];

    if (input.startedAt !== undefined) {
      updates.push('started_at = ?');
      values.push(input.startedAt);
    }

    if (input.endedAt !== undefined) {
      updates.push('ended_at = ?');
      values.push(input.endedAt);
    }

    if (input.durationMinutes !== undefined) {
      updates.push('duration_minutes = ?');
      values.push(input.durationMinutes);
    }

    if (updates.length === 0) {
      return entry;
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id as unknown as number); // id for WHERE clause

    await this.db
      .prepare(`UPDATE time_entries SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM time_entries WHERE id = ?')
      .bind(id)
      .run();

    return (result.meta?.changes ?? 0) > 0;
  }

  async deleteByTaskId(taskId: string): Promise<number> {
    const result = await this.db
      .prepare('DELETE FROM time_entries WHERE task_id = ?')
      .bind(taskId)
      .run();

    return result.meta?.changes ?? 0;
  }

  // Get total duration for a task (sum of all completed entries)
  async getTotalDurationByTaskId(taskId: string): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT SUM(duration_minutes) as total FROM time_entries
         WHERE task_id = ? AND duration_minutes IS NOT NULL`
      )
      .bind(taskId)
      .first<{ total: number | null }>();

    return result?.total ?? 0;
  }

  // Get average duration for repeating tasks with the same title
  async getAverageDurationByTaskTitle(workspaceId: string, title: string): Promise<number | null> {
    const result = await this.db
      .prepare(
        `SELECT AVG(te.duration_minutes) as avg_duration
         FROM time_entries te
         JOIN tasks t ON te.task_id = t.id
         WHERE t.workspace_id = ?
         AND t.title = ?
         AND te.duration_minutes IS NOT NULL`
      )
      .bind(workspaceId, title)
      .first<{ avg_duration: number | null }>();

    return result?.avg_duration ?? null;
  }

  // Get time entries for a date range
  async findByDateRange(
    taskIds: string[],
    startDate: number,
    endDate: number
  ): Promise<TimeEntry[]> {
    if (taskIds.length === 0) return [];

    const placeholders = taskIds.map(() => '?').join(',');
    const result = await this.db
      .prepare(
        `SELECT * FROM time_entries
         WHERE task_id IN (${placeholders})
         AND started_at >= ?
         AND started_at <= ?
         ORDER BY started_at DESC`
      )
      .bind(...taskIds, startDate, endDate)
      .all<TimeEntryRow>();

    return (result.results ?? []).map(rowToTimeEntry);
  }
}
