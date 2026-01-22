import type { D1Database } from '@cloudflare/workers-types';
import type { Task, TaskStatus } from '../../shared/types/index';
import { generateId, nowUnix } from '../../shared/utils/index';

interface TaskRow {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  sort_order: number;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  started_at: number | null;
  completed_at: number | null;
  status: TaskStatus;
  created_at: number;
  updated_at: number;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description ?? undefined,
    scheduledDate: row.scheduled_date,
    sortOrder: row.sort_order,
    estimatedMinutes: row.estimated_minutes ?? undefined,
    actualMinutes: row.actual_minutes ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateTaskInput {
  workspaceId: string;
  title: string;
  description?: string;
  scheduledDate: string;
  estimatedMinutes?: number;
  sortOrder?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  scheduledDate?: string;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  status?: TaskStatus;
  sortOrder?: number;
}

export class TaskRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<Task | null> {
    const row = await this.db
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .bind(id)
      .first<TaskRow>();

    return row ? rowToTask(row) : null;
  }

  async findByWorkspaceId(
    workspaceId: string,
    options?: { date?: string; status?: TaskStatus }
  ): Promise<Task[]> {
    let query = 'SELECT * FROM tasks WHERE workspace_id = ?';
    const params: (string | number)[] = [workspaceId];

    if (options?.date) {
      query += ' AND scheduled_date = ?';
      params.push(options.date);
    }

    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY scheduled_date ASC, sort_order ASC';

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<TaskRow>();

    return (result.results ?? []).map(rowToTask);
  }

  async findPendingByWorkspaceIdBeforeDate(
    workspaceId: string,
    beforeDate: string
  ): Promise<Task[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE workspace_id = ?
         AND scheduled_date < ?
         AND status IN ('pending', 'in_progress')
         ORDER BY scheduled_date ASC, sort_order ASC`
      )
      .bind(workspaceId, beforeDate)
      .all<TaskRow>();

    return (result.results ?? []).map(rowToTask);
  }

  async getMaxSortOrder(workspaceId: string, date: string): Promise<number> {
    const result = await this.db
      .prepare(
        'SELECT MAX(sort_order) as max_order FROM tasks WHERE workspace_id = ? AND scheduled_date = ?'
      )
      .bind(workspaceId, date)
      .first<{ max_order: number | null }>();

    return result?.max_order ?? -1;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const id = generateId();
    const now = nowUnix();
    const sortOrder = input.sortOrder ?? (await this.getMaxSortOrder(input.workspaceId, input.scheduledDate)) + 1;

    await this.db
      .prepare(
        `INSERT INTO tasks
         (id, workspace_id, title, description, scheduled_date, sort_order, estimated_minutes, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
      )
      .bind(
        id,
        input.workspaceId,
        input.title,
        input.description ?? null,
        input.scheduledDate,
        sortOrder,
        input.estimatedMinutes ?? null,
        now,
        now
      )
      .run();

    return (await this.findById(id))!;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    const task = await this.findById(id);
    if (!task) return null;

    const now = nowUnix();
    const updates: string[] = ['updated_at = ?'];
    const values: (string | number | null)[] = [now];

    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.scheduledDate !== undefined) {
      updates.push('scheduled_date = ?');
      values.push(input.scheduledDate);
    }
    if (input.estimatedMinutes !== undefined) {
      updates.push('estimated_minutes = ?');
      values.push(input.estimatedMinutes);
    }
    if (input.actualMinutes !== undefined) {
      updates.push('actual_minutes = ?');
      values.push(input.actualMinutes);
    }
    if (input.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      values.push(input.sortOrder);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);

      // Handle status-specific timestamps
      if (input.status === 'in_progress' && !task.startedAt) {
        updates.push('started_at = ?');
        values.push(now);
      }
      if (input.status === 'completed' && !task.completedAt) {
        updates.push('completed_at = ?');
        values.push(now);
        // Calculate actual minutes if not set
        if (task.startedAt && input.actualMinutes === undefined) {
          const actualMins = Math.round((now - task.startedAt) / 60);
          updates.push('actual_minutes = ?');
          values.push(actualMins);
        }
      }
    }

    values.push(id);

    await this.db
      .prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return this.findById(id);
  }

  async updateSortOrders(taskOrders: { id: string; sortOrder: number }[]): Promise<void> {
    const now = nowUnix();
    const statements = taskOrders.map(({ id, sortOrder }) =>
      this.db
        .prepare('UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?')
        .bind(sortOrder, now, id)
    );

    await this.db.batch(statements);
  }

  async carryOver(taskIds: string[], targetDate: string): Promise<Task[]> {
    const now = nowUnix();
    const tasks = await Promise.all(taskIds.map(id => this.findById(id)));
    const validTasks = tasks.filter((t): t is Task => t !== null);

    if (validTasks.length === 0) return [];

    // Get max sort order for target date
    const maxOrder = await this.getMaxSortOrder(validTasks[0].workspaceId, targetDate);

    const statements = validTasks.map((task, index) =>
      this.db
        .prepare(
          `UPDATE tasks SET
           scheduled_date = ?,
           sort_order = ?,
           status = 'carried_over',
           updated_at = ?
           WHERE id = ?`
        )
        .bind(targetDate, maxOrder + 1 + index, now, task.id)
    );

    await this.db.batch(statements);

    return Promise.all(taskIds.map(id => this.findById(id))).then(
      results => results.filter((t): t is Task => t !== null)
    );
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM tasks WHERE id = ?')
      .bind(id)
      .run();

    return (result.meta?.changes ?? 0) > 0;
  }

  async belongsToWorkspace(taskId: string, workspaceId: string): Promise<boolean> {
    const task = await this.findById(taskId);
    return task?.workspaceId === workspaceId;
  }
}
