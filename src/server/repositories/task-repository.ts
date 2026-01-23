import type { D1Database } from '@cloudflare/workers-types';
import type { Task, TaskStatus, RepeatPattern } from '../../shared/types/index';
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
  status: TaskStatus;
  repeat_pattern: RepeatPattern | null;
  repeat_end_date: string | null;
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
    status: row.status,
    repeatPattern: row.repeat_pattern ?? undefined,
    repeatEndDate: row.repeat_end_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Check if a repeating task should appear on a given date
function shouldRepeatOnDate(task: Task, date: string): boolean {
  if (!task.repeatPattern) return false;
  if (task.scheduledDate > date) return false;
  if (task.repeatEndDate && task.repeatEndDate < date) return false;

  const taskDate = new Date(task.scheduledDate);
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 6 = Saturday

  switch (task.repeatPattern) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekly': {
      // Same day of week as original
      const taskDayOfWeek = taskDate.getDay();
      return dayOfWeek === taskDayOfWeek;
    }
    case 'monthly': {
      // Same day of month as original
      const taskDayOfMonth = taskDate.getDate();
      return targetDate.getDate() === taskDayOfMonth;
    }
    default:
      return false;
  }
}

export interface CreateTaskInput {
  workspaceId: string;
  title: string;
  description?: string;
  scheduledDate: string;
  estimatedMinutes?: number;
  sortOrder?: number;
  repeatPattern?: RepeatPattern;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  scheduledDate?: string;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  status?: TaskStatus;
  sortOrder?: number;
  repeatPattern?: RepeatPattern | null;
  repeatEndDate?: string | null;
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
    if (options?.date) {
      // When querying by date, include both:
      // 1. Tasks scheduled for that exact date (non-repeating or first occurrence)
      // 2. Repeating tasks that should appear on that date
      return this.findByWorkspaceIdAndDate(workspaceId, options.date, options.status);
    }

    let query = 'SELECT * FROM tasks WHERE workspace_id = ?';
    const params: (string | number)[] = [workspaceId];

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

  private async findByWorkspaceIdAndDate(
    workspaceId: string,
    date: string,
    status?: TaskStatus
  ): Promise<Task[]> {
    // Get tasks scheduled for this exact date (non-repeating)
    let nonRepeatingQuery = `
      SELECT * FROM tasks
      WHERE workspace_id = ?
      AND scheduled_date = ?
      AND repeat_pattern IS NULL
    `;
    const nonRepeatingParams: (string | number)[] = [workspaceId, date];

    if (status) {
      nonRepeatingQuery += ' AND status = ?';
      nonRepeatingParams.push(status);
    }

    const nonRepeatingResult = await this.db
      .prepare(nonRepeatingQuery)
      .bind(...nonRepeatingParams)
      .all<TaskRow>();

    // Get all repeating tasks for this workspace that could appear on this date
    let repeatingQuery = `
      SELECT * FROM tasks
      WHERE workspace_id = ?
      AND repeat_pattern IS NOT NULL
      AND scheduled_date <= ?
      AND (repeat_end_date IS NULL OR repeat_end_date >= ?)
    `;
    const repeatingParams: (string | number)[] = [workspaceId, date, date];

    if (status) {
      repeatingQuery += ' AND status = ?';
      repeatingParams.push(status);
    }

    const repeatingResult = await this.db
      .prepare(repeatingQuery)
      .bind(...repeatingParams)
      .all<TaskRow>();

    const nonRepeatingTasks = (nonRepeatingResult.results ?? []).map(rowToTask);
    const repeatingTasks = (repeatingResult.results ?? [])
      .map(rowToTask)
      .filter((task) => shouldRepeatOnDate(task, date));

    // Combine and sort by sort_order
    return [...nonRepeatingTasks, ...repeatingTasks].sort((a, b) => a.sortOrder - b.sortOrder);
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
         (id, workspace_id, title, description, scheduled_date, sort_order, estimated_minutes, status, repeat_pattern, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
      )
      .bind(
        id,
        input.workspaceId,
        input.title,
        input.description ?? null,
        input.scheduledDate,
        sortOrder,
        input.estimatedMinutes ?? null,
        input.repeatPattern ?? null,
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
    if (input.repeatPattern !== undefined) {
      updates.push('repeat_pattern = ?');
      values.push(input.repeatPattern);
    }
    if (input.repeatEndDate !== undefined) {
      updates.push('repeat_end_date = ?');
      values.push(input.repeatEndDate);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);

      // Handle status-specific timestamps
      if (input.status === 'in_progress' && !task.startedAt) {
        updates.push('started_at = ?');
        values.push(now);
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

  // Get repeating tasks for a workspace
  async findRepeatingByWorkspaceId(workspaceId: string): Promise<Task[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE workspace_id = ?
         AND repeat_pattern IS NOT NULL
         ORDER BY scheduled_date ASC, sort_order ASC`
      )
      .bind(workspaceId)
      .all<TaskRow>();

    return (result.results ?? []).map(rowToTask);
  }

  // End repeat for a task (set repeat_end_date)
  async endRepeat(id: string, endDate: string): Promise<Task | null> {
    return this.update(id, { repeatEndDate: endDate });
  }

  // Remove repeat pattern entirely
  async removeRepeat(id: string): Promise<Task | null> {
    return this.update(id, { repeatPattern: null, repeatEndDate: null });
  }
}
