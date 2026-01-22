import type { D1Database } from '@cloudflare/workers-types';
import type { TaskComment } from '../../shared/types/index';
import { generateId, nowUnix } from '../../shared/utils/index';

interface TaskCommentRow {
  id: string;
  task_id: string;
  content: string;
  created_at: number;
  updated_at: number;
}

function rowToTaskComment(row: TaskCommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TaskCommentRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<TaskComment | null> {
    const row = await this.db
      .prepare('SELECT * FROM task_comments WHERE id = ?')
      .bind(id)
      .first<TaskCommentRow>();

    return row ? rowToTaskComment(row) : null;
  }

  async findByTaskId(taskId: string): Promise<TaskComment[]> {
    const result = await this.db
      .prepare('SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC')
      .bind(taskId)
      .all<TaskCommentRow>();

    return (result.results ?? []).map(rowToTaskComment);
  }

  async create(input: { taskId: string; content: string }): Promise<TaskComment> {
    const id = generateId();
    const now = nowUnix();

    await this.db
      .prepare(
        'INSERT INTO task_comments (id, task_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(id, input.taskId, input.content, now, now)
      .run();

    return {
      id,
      taskId: input.taskId,
      content: input.content,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(id: string, content: string): Promise<TaskComment | null> {
    const comment = await this.findById(id);
    if (!comment) return null;

    const now = nowUnix();

    await this.db
      .prepare('UPDATE task_comments SET content = ?, updated_at = ? WHERE id = ?')
      .bind(content, now, id)
      .run();

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM task_comments WHERE id = ?')
      .bind(id)
      .run();

    return (result.meta?.changes ?? 0) > 0;
  }

  async deleteByTaskId(taskId: string): Promise<number> {
    const result = await this.db
      .prepare('DELETE FROM task_comments WHERE task_id = ?')
      .bind(taskId)
      .run();

    return result.meta?.changes ?? 0;
  }
}
