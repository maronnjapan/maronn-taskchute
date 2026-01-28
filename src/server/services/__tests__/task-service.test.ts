/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskService as RealTaskService } from '../task-service';
import type { TaskRepository } from '../../repositories/task-repository';
import type { TimeEntryRepository } from '../../repositories/time-entry-repository';
import type { Task as SharedTask, TimeEntry } from '../../../shared/types/index';

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

  createTask(input: {
    workspaceId: string;
    title: string;
    scheduledDate: string;
    estimatedMinutes?: number;
  }): Task {
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

  getTasksByDate(workspaceId: string, scheduledDate: string): Task[] {
    return this.tasks
      .filter(t => t.workspaceId === workspaceId && t.scheduledDate === scheduledDate)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  updateTask(id: string, updates: Partial<Task>): Task {
    const task = this.tasks.find(t => t.id === id);
    if (!task) {
      throw new Error('タスクが見つかりません');
    }

    Object.assign(task, updates, { updatedAt: new Date() });
    return task;
  }

  deleteTask(id: string): void {
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
    it('タイトルと日付を指定してタスクを作成できる', () => {
      const input = {
        workspaceId: 'workspace-1',
        title: 'テストタスク',
        scheduledDate: '2024-01-15',
      };

      const result = taskService.createTask(input);

      expect(result.title).toBe('テストタスク');
      expect(result.scheduledDate).toBe('2024-01-15');
      expect(result.status).toBe('pending');
      expect(result.workspaceId).toBe('workspace-1');
      expect(result.id).toBeTruthy();
    });

    it('見積もり時間を指定してタスクを作成できる', () => {
      const input = {
        workspaceId: 'workspace-1',
        title: 'タスク',
        scheduledDate: '2024-01-15',
        estimatedMinutes: 60,
      };

      const result = taskService.createTask(input);

      expect(result.estimatedMinutes).toBe(60);
    });

    it('タイトルが空の場合はエラーを返す', () => {
      const input = {
        workspaceId: 'workspace-1',
        title: '',
        scheduledDate: '2024-01-15',
      };

      expect(() => taskService.createTask(input))
        .toThrow('タイトルは必須です');
    });

    it('複数のタスクを作成すると sortOrder が自動的に割り当てられる', () => {
      taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク1',
        scheduledDate: '2024-01-15',
      });

      taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク2',
        scheduledDate: '2024-01-15',
      });

      const tasks = taskService.getTasksByDate('workspace-1', '2024-01-15');
      expect(tasks[0].sortOrder).toBe(0);
      expect(tasks[1].sortOrder).toBe(1);
    });
  });

  describe('getTasksByDate', () => {
    it('指定した日付のタスク一覧を取得できる', () => {
      taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク1',
        scheduledDate: '2024-01-15',
      });

      taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク2',
        scheduledDate: '2024-01-15',
      });

      taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク3',
        scheduledDate: '2024-01-16',
      });

      const tasks = taskService.getTasksByDate('workspace-1', '2024-01-15');

      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('タスク1');
      expect(tasks[1].title).toBe('タスク2');
    });

    it('該当するタスクがない場合は空配列を返す', () => {
      const tasks = taskService.getTasksByDate('workspace-1', '2024-01-15');
      expect(tasks).toEqual([]);
    });

    it('タスクは sortOrder でソートされて返される', () => {
      taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスクA',
        scheduledDate: '2024-01-15',
      });

      taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスクB',
        scheduledDate: '2024-01-15',
      });

      const tasks = taskService.getTasksByDate('workspace-1', '2024-01-15');

      expect(tasks[0].title).toBe('タスクA');
      expect(tasks[1].title).toBe('タスクB');
    });
  });

  describe('updateTask', () => {
    it('タスクのタイトルを更新できる', () => {
      const task = taskService.createTask({
        workspaceId: 'workspace-1',
        title: '元のタイトル',
        scheduledDate: '2024-01-15',
      });

      const updated = taskService.updateTask(task.id, {
        title: '新しいタイトル',
      });

      expect(updated.title).toBe('新しいタイトル');
      expect(updated.id).toBe(task.id);
    });

    it('タスクのステータスを更新できる', () => {
      const task = taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク',
        scheduledDate: '2024-01-15',
      });

      const updated = taskService.updateTask(task.id, {
        status: 'in_progress',
      });

      expect(updated.status).toBe('in_progress');
    });

    it('存在しないタスクを更新しようとするとエラーを返す', () => {
      expect(() => taskService.updateTask('non-existent', { title: 'test' }))
        .toThrow('タスクが見つかりません');
    });
  });

  describe('deleteTask', () => {
    it('タスクを削除できる', () => {
      const task = taskService.createTask({
        workspaceId: 'workspace-1',
        title: 'タスク',
        scheduledDate: '2024-01-15',
      });

      taskService.deleteTask(task.id);

      const tasks = taskService.getTasksByDate('workspace-1', '2024-01-15');
      expect(tasks).toHaveLength(0);
    });

    it('存在しないタスクを削除しようとするとエラーを返す', () => {
      expect(() => taskService.deleteTask('non-existent'))
        .toThrow('タスクが見つかりません');
    });
  });
});

describe('TaskService (実際のクラス)', () => {
  let service: RealTaskService;
  let mockTaskRepo: TaskRepository;
  let mockTimeEntryRepo: TimeEntryRepository;

  beforeEach(() => {
    mockTaskRepo = {
      findByWorkspaceId: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateSortOrders: vi.fn(),
      belongsToWorkspace: vi.fn(),
      findRepeatingByWorkspaceId: vi.fn(),
      endRepeat: vi.fn(),
      removeRepeat: vi.fn(),
      getMaxSortOrder: vi.fn(),
    } as unknown as TaskRepository;

    mockTimeEntryRepo = {
      getDailyDurationsByTaskIds: vi.fn(),
      findActiveByTaskIdsAndDate: vi.fn(),
      findByTaskIdAndDate: vi.fn(),
      getDailyDurationByTaskId: vi.fn(),
      findActiveByTaskIdAndDate: vi.fn(),
      findByTaskId: vi.fn(),
      findActiveByTaskId: vi.fn(),
      findByTaskIds: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByTaskId: vi.fn(),
      getTotalDurationByTaskId: vi.fn(),
      getAverageDurationByTaskTitle: vi.fn(),
      findByDateRange: vi.fn(),
      findById: vi.fn(),
    } as unknown as TimeEntryRepository;

    service = new RealTaskService(mockTaskRepo, mockTimeEntryRepo);
  });

  describe('繰り返しタスクの日次リセット', () => {
    const repeatingTask: SharedTask = {
      id: 'task-1',
      workspaceId: 'ws-1',
      title: '毎日のタスク',
      scheduledDate: '2024-01-01',
      sortOrder: 0,
      status: 'in_progress',
      repeatPattern: 'daily',
      actualMinutes: 120, // 過去の累計値
      startedAt: 1704067200, // 過去の開始時刻
      createdAt: 1704067200,
      updatedAt: 1704153600,
    };

    const nonRepeatingTask: SharedTask = {
      id: 'task-2',
      workspaceId: 'ws-1',
      title: '通常タスク',
      scheduledDate: '2024-01-15',
      sortOrder: 1,
      status: 'in_progress',
      actualMinutes: 30,
      startedAt: 1705305600,
      createdAt: 1705305600,
      updatedAt: 1705305600,
    };

    it('繰り返しタスクの actualMinutes がその日の記録のみになる', async () => {
      vi.mocked(mockTaskRepo.findByWorkspaceId).mockResolvedValue([repeatingTask]);
      vi.mocked(mockTimeEntryRepo.getDailyDurationsByTaskIds).mockResolvedValue(
        new Map([['task-1', 25]]) // その日は25分だけ
      );
      vi.mocked(mockTimeEntryRepo.findActiveByTaskIdsAndDate).mockResolvedValue(new Map());

      const result = await service.getTasksByWorkspace('ws-1', { date: '2024-01-15' });

      expect(result).toHaveLength(1);
      expect(result[0].actualMinutes).toBe(25);
    });

    it('繰り返しタスクの actualMinutes がその日に記録なしの場合 undefined になる', async () => {
      vi.mocked(mockTaskRepo.findByWorkspaceId).mockResolvedValue([repeatingTask]);
      vi.mocked(mockTimeEntryRepo.getDailyDurationsByTaskIds).mockResolvedValue(new Map());
      vi.mocked(mockTimeEntryRepo.findActiveByTaskIdsAndDate).mockResolvedValue(new Map());

      const result = await service.getTasksByWorkspace('ws-1', { date: '2024-01-15' });

      expect(result).toHaveLength(1);
      expect(result[0].actualMinutes).toBeUndefined();
    });

    it('繰り返しタスクの status がその日にアクティブなエントリがなければ pending にリセットされる', async () => {
      vi.mocked(mockTaskRepo.findByWorkspaceId).mockResolvedValue([repeatingTask]);
      vi.mocked(mockTimeEntryRepo.getDailyDurationsByTaskIds).mockResolvedValue(new Map());
      vi.mocked(mockTimeEntryRepo.findActiveByTaskIdsAndDate).mockResolvedValue(new Map());

      const result = await service.getTasksByWorkspace('ws-1', { date: '2024-01-15' });

      expect(result[0].status).toBe('pending');
    });

    it('繰り返しタスクの status がその日にアクティブなエントリがあれば in_progress になる', async () => {
      const activeEntry: TimeEntry = {
        id: 'entry-1',
        taskId: 'task-1',
        startedAt: 1705305600,
        createdAt: 1705305600,
        updatedAt: 1705305600,
      };

      vi.mocked(mockTaskRepo.findByWorkspaceId).mockResolvedValue([repeatingTask]);
      vi.mocked(mockTimeEntryRepo.getDailyDurationsByTaskIds).mockResolvedValue(new Map());
      vi.mocked(mockTimeEntryRepo.findActiveByTaskIdsAndDate).mockResolvedValue(
        new Map([['task-1', activeEntry]])
      );

      const result = await service.getTasksByWorkspace('ws-1', { date: '2024-01-15' });

      expect(result[0].status).toBe('in_progress');
      expect(result[0].startedAt).toBe(activeEntry.startedAt);
    });

    it('繰り返しタスクの status がその日に完了済み記録があれば in_progress になる', async () => {
      vi.mocked(mockTaskRepo.findByWorkspaceId).mockResolvedValue([repeatingTask]);
      vi.mocked(mockTimeEntryRepo.getDailyDurationsByTaskIds).mockResolvedValue(
        new Map([['task-1', 30]])
      );
      vi.mocked(mockTimeEntryRepo.findActiveByTaskIdsAndDate).mockResolvedValue(new Map());

      const result = await service.getTasksByWorkspace('ws-1', { date: '2024-01-15' });

      expect(result[0].status).toBe('in_progress');
    });

    it('繰り返しタスクの startedAt がその日のアクティブエントリなしなら undefined にリセットされる', async () => {
      vi.mocked(mockTaskRepo.findByWorkspaceId).mockResolvedValue([repeatingTask]);
      vi.mocked(mockTimeEntryRepo.getDailyDurationsByTaskIds).mockResolvedValue(new Map());
      vi.mocked(mockTimeEntryRepo.findActiveByTaskIdsAndDate).mockResolvedValue(new Map());

      const result = await service.getTasksByWorkspace('ws-1', { date: '2024-01-15' });

      expect(result[0].startedAt).toBeUndefined();
    });

    it('非繰り返しタスクは影響を受けない', async () => {
      vi.mocked(mockTaskRepo.findByWorkspaceId).mockResolvedValue([nonRepeatingTask]);

      const result = await service.getTasksByWorkspace('ws-1', { date: '2024-01-15' });

      expect(result).toHaveLength(1);
      expect(result[0].actualMinutes).toBe(30);
      expect(result[0].status).toBe('in_progress');
      expect(result[0].startedAt).toBe(1705305600);
    });

    it('繰り返しタスクと非繰り返しタスクが混在する場合、繰り返しタスクのみリセットされる', async () => {
      vi.mocked(mockTaskRepo.findByWorkspaceId).mockResolvedValue([repeatingTask, nonRepeatingTask]);
      vi.mocked(mockTimeEntryRepo.getDailyDurationsByTaskIds).mockResolvedValue(
        new Map([['task-1', 10]])
      );
      vi.mocked(mockTimeEntryRepo.findActiveByTaskIdsAndDate).mockResolvedValue(new Map());

      const result = await service.getTasksByWorkspace('ws-1', { date: '2024-01-15' });

      expect(result).toHaveLength(2);
      // 繰り返しタスク: リセットされる
      expect(result[0].id).toBe('task-1');
      expect(result[0].actualMinutes).toBe(10);
      expect(result[0].status).toBe('in_progress');
      // 非繰り返しタスク: そのまま
      expect(result[1].id).toBe('task-2');
      expect(result[1].actualMinutes).toBe(30);
      expect(result[1].status).toBe('in_progress');
    });

    it('日付フィルタなしの場合はリセットしない', async () => {
      vi.mocked(mockTaskRepo.findByWorkspaceId).mockResolvedValue([repeatingTask]);

      const result = await service.getTasksByWorkspace('ws-1');

      expect(result[0].actualMinutes).toBe(120); // 元の累計値のまま
      expect(result[0].status).toBe('in_progress'); // 元のステータスのまま
      expect(mockTimeEntryRepo.getDailyDurationsByTaskIds).not.toHaveBeenCalled();
    });
  });
});
