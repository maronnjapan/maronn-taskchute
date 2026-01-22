import { describe, it, expect, beforeEach } from 'vitest';

interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  scheduledDate: string;
  sortOrder: number;
  estimatedMinutes?: number;
  actualMinutes?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'carried_over';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * タスクサービス（モック実装）
 */
class TaskService {
  private tasks: Task[] = [];
  private idCounter = 1;

  async createTask(input: {
    workspaceId: string;
    title: string;
    scheduledDate: string;
    estimatedMinutes?: number;
  }): Promise<Task> {
    if (!input.title || input.title.trim().length === 0) {
      throw new Error('タイトルは必須です');
    }

    const task: Task = {
      id: `task-${this.idCounter++}`,
      workspaceId: input.workspaceId,
      title: input.title,
      scheduledDate: input.scheduledDate,
      sortOrder: this.tasks.length,
      estimatedMinutes: input.estimatedMinutes,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.push(task);
    return task;
  }

  async getTasksByDate(workspaceId: string, scheduledDate: string): Promise<Task[]> {
    return this.tasks
      .filter(t => t.workspaceId === workspaceId && t.scheduledDate === scheduledDate)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const task = this.tasks.find(t => t.id === id);
    if (!task) {
      throw new Error('タスクが見つかりません');
    }

    Object.assign(task, updates, { updatedAt: new Date() });
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error('タスクが見つかりません');
    }
    this.tasks.splice(index, 1);
  }

  // テスト用のリセット機能
  reset() {
    this.tasks = [];
    this.idCounter = 1;
  }
}

describe('TaskService', () => {
  let taskService: TaskService;

  beforeEach(() => {
    taskService = new TaskService();
  });

  describe('createTask', () => {
    it('タイトルと日付を指定してタスクを作成できる', async () => {
      const input = {
        workspaceId: 'workspace-1',
        title: 'テストタスク',
        scheduledDate: '2024-01-15',
      };

      const result = await taskService.createTask(input);

      expect(result.title).toBe('テストタスク');
      expect(result.scheduledDate).toBe('2024-01-15');
      expect(result.status).toBe('pending');
      expect(result.workspaceId).toBe('workspace-1');
      expect(result.id).toBeTruthy();
    });

    it('見積もり時間を指定してタスクを作成できる', async () => {
      const input = {
        workspaceId: 'workspace-1',
        title: 'タスク',
        scheduledDate: '2024-01-15',
        estimatedMinutes: 60,
      };

      const result = await taskService.createTask(input);

      expect(result.estimatedMinutes).toBe(60);
    });

    it('タイトルが空の場合はエラーを返す', async () => {
      const input = {
        workspaceId: 'workspace-1',
        title: '',
        scheduledDate: '2024-01-15',
      };

      await expect(taskService.createTask(input))
        .rejects.toThrow('タイトルは必須です');
    });

    it('複数のタスクを作成すると sortOrder が自動的に割り当てられる', async () => {
      await taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク1',
        scheduledDate: '2024-01-15',
      });

      await taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク2',
        scheduledDate: '2024-01-15',
      });

      const tasks = await taskService.getTasksByDate('workspace-1', '2024-01-15');
      expect(tasks[0].sortOrder).toBe(0);
      expect(tasks[1].sortOrder).toBe(1);
    });
  });

  describe('getTasksByDate', () => {
    it('指定した日付のタスク一覧を取得できる', async () => {
      await taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク1',
        scheduledDate: '2024-01-15',
      });

      await taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク2',
        scheduledDate: '2024-01-15',
      });

      await taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク3',
        scheduledDate: '2024-01-16',
      });

      const tasks = await taskService.getTasksByDate('workspace-1', '2024-01-15');

      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('タスク1');
      expect(tasks[1].title).toBe('タスク2');
    });

    it('該当するタスクがない場合は空配列を返す', async () => {
      const tasks = await taskService.getTasksByDate('workspace-1', '2024-01-15');
      expect(tasks).toEqual([]);
    });

    it('タスクは sortOrder でソートされて返される', async () => {
      await taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスクA',
        scheduledDate: '2024-01-15',
      });

      await taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスクB',
        scheduledDate: '2024-01-15',
      });

      const tasks = await taskService.getTasksByDate('workspace-1', '2024-01-15');

      expect(tasks[0].title).toBe('タスクA');
      expect(tasks[1].title).toBe('タスクB');
    });
  });

  describe('updateTask', () => {
    it('タスクのタイトルを更新できる', async () => {
      const task = await taskService.createTask({
        workspaceId: 'workspace-1',
        title: '元のタイトル',
        scheduledDate: '2024-01-15',
      });

      const updated = await taskService.updateTask(task.id, {
        title: '新しいタイトル',
      });

      expect(updated.title).toBe('新しいタイトル');
      expect(updated.id).toBe(task.id);
    });

    it('タスクのステータスを更新できる', async () => {
      const task = await taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク',
        scheduledDate: '2024-01-15',
      });

      const updated = await taskService.updateTask(task.id, {
        status: 'in_progress',
      });

      expect(updated.status).toBe('in_progress');
    });

    it('存在しないタスクを更新しようとするとエラーを返す', async () => {
      await expect(taskService.updateTask('non-existent', { title: 'test' }))
        .rejects.toThrow('タスクが見つかりません');
    });
  });

  describe('deleteTask', () => {
    it('タスクを削除できる', async () => {
      const task = await taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク',
        scheduledDate: '2024-01-15',
      });

      await taskService.deleteTask(task.id);

      const tasks = await taskService.getTasksByDate('workspace-1', '2024-01-15');
      expect(tasks).toHaveLength(0);
    });

    it('存在しないタスクを削除しようとするとエラーを返す', async () => {
      await expect(taskService.deleteTask('non-existent'))
        .rejects.toThrow('タスクが見つかりません');
    });
  });
});
