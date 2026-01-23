/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeEntryService } from '../time-entry-service';
import type { TimeEntryRepository } from '../../repositories/time-entry-repository';
import type { TaskRepository } from '../../repositories/task-repository';
import type { TimeEntry } from '../../../shared/types/index';

describe('TimeEntryService', () => {
  let timeEntryService: TimeEntryService;
  let mockTimeEntryRepo: TimeEntryRepository;
  let mockTaskRepo: TaskRepository;

  beforeEach(() => {
    // Mock repositories
    mockTimeEntryRepo = {
      findById: vi.fn(),
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
    } as unknown as TimeEntryRepository;

    mockTaskRepo = {
      update: vi.fn(),
    } as unknown as TaskRepository;

    timeEntryService = new TimeEntryService(mockTimeEntryRepo, mockTaskRepo);
  });

  describe('startTimeEntry', () => {
    it('時間記録を開始すると、タスクのステータスが in_progress になる', async () => {
      const taskId = 'task-1';
      const mockEntry: TimeEntry = {
        id: 'entry-1',
        taskId,
        startedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockedStart = vi.mocked(mockTimeEntryRepo.start);
      const mockedTaskUpdate = vi.mocked(mockTaskRepo.update);

      mockedStart.mockResolvedValue(mockEntry);
      mockedTaskUpdate.mockResolvedValue(null);

      await timeEntryService.startTimeEntry(taskId);

      expect(mockedTaskUpdate).toHaveBeenCalledWith(taskId, { status: 'in_progress' });
      expect(mockedStart).toHaveBeenCalledWith(taskId);
    });
  });

  describe('stopTimeEntry', () => {
    it('時間記録を停止すると、totalDuration > 0の場合は in_progress のまま', async () => {
      const entryId = 'entry-1';
      const taskId = 'task-1';
      const mockEntry: TimeEntry = {
        id: entryId,
        taskId,
        startedAt: Date.now() - 3600,
        endedAt: Date.now(),
        durationMinutes: 60,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockedStop = vi.mocked(mockTimeEntryRepo.stop);
      const mockedGetTotalDuration = vi.mocked(mockTimeEntryRepo.getTotalDurationByTaskId);
      const mockedTaskUpdate = vi.mocked(mockTaskRepo.update);

      mockedStop.mockResolvedValue(mockEntry);
      mockedGetTotalDuration.mockResolvedValue(60); // 60分の記録がある
      mockedTaskUpdate.mockResolvedValue(null);

      await timeEntryService.stopTimeEntry(entryId);

      expect(mockedTaskUpdate).toHaveBeenCalledWith(taskId, {
        actualMinutes: 60,
        status: 'in_progress', // totalDuration > 0なので in_progress のまま
      });
    });

    it('時間記録を停止すると、totalDuration === 0の場合は pending に戻る', async () => {
      const entryId = 'entry-1';
      const taskId = 'task-1';
      const mockEntry: TimeEntry = {
        id: entryId,
        taskId,
        startedAt: Date.now() - 10,
        endedAt: Date.now(),
        durationMinutes: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockedStop = vi.mocked(mockTimeEntryRepo.stop);
      const mockedGetTotalDuration = vi.mocked(mockTimeEntryRepo.getTotalDurationByTaskId);
      const mockedTaskUpdate = vi.mocked(mockTaskRepo.update);

      mockedStop.mockResolvedValue(mockEntry);
      mockedGetTotalDuration.mockResolvedValue(0); // 記録なし
      mockedTaskUpdate.mockResolvedValue(null);

      await timeEntryService.stopTimeEntry(entryId);

      expect(mockedTaskUpdate).toHaveBeenCalledWith(taskId, {
        actualMinutes: 0,
        status: 'pending', // totalDuration === 0なので pending に戻る
      });
    });

    it('エントリが存在しない場合は何もしない', async () => {
      const entryId = 'entry-1';

      const mockedStop = vi.mocked(mockTimeEntryRepo.stop);
      const mockedTaskUpdate = vi.mocked(mockTaskRepo.update);

      mockedStop.mockResolvedValue(null);

      const result = await timeEntryService.stopTimeEntry(entryId);

      expect(result).toBeNull();
      expect(mockedTaskUpdate).not.toHaveBeenCalled();
    });
  });

  describe('updateTimeEntry', () => {
    it('時間記録を更新すると、totalDuration > 0の場合は in_progress になる', async () => {
      const entryId = 'entry-1';
      const taskId = 'task-1';
      const mockEntry: TimeEntry = {
        id: entryId,
        taskId,
        startedAt: Date.now() - 3600,
        endedAt: Date.now(),
        durationMinutes: 60,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockedUpdate = vi.mocked(mockTimeEntryRepo.update);
      const mockedGetTotalDuration = vi.mocked(mockTimeEntryRepo.getTotalDurationByTaskId);
      const mockedTaskUpdate = vi.mocked(mockTaskRepo.update);

      mockedUpdate.mockResolvedValue(mockEntry);
      mockedGetTotalDuration.mockResolvedValue(60);
      mockedTaskUpdate.mockResolvedValue(null);

      await timeEntryService.updateTimeEntry(entryId, { durationMinutes: 60 });

      expect(mockedTaskUpdate).toHaveBeenCalledWith(taskId, {
        actualMinutes: 60,
        status: 'in_progress',
      });
    });

    it('時間記録を更新すると、totalDuration === 0の場合は pending になる', async () => {
      const entryId = 'entry-1';
      const taskId = 'task-1';
      const mockEntry: TimeEntry = {
        id: entryId,
        taskId,
        startedAt: Date.now() - 10,
        endedAt: Date.now(),
        durationMinutes: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockedUpdate = vi.mocked(mockTimeEntryRepo.update);
      const mockedGetTotalDuration = vi.mocked(mockTimeEntryRepo.getTotalDurationByTaskId);
      const mockedTaskUpdate = vi.mocked(mockTaskRepo.update);

      mockedUpdate.mockResolvedValue(mockEntry);
      mockedGetTotalDuration.mockResolvedValue(0);
      mockedTaskUpdate.mockResolvedValue(null);

      await timeEntryService.updateTimeEntry(entryId, { durationMinutes: 0 });

      expect(mockedTaskUpdate).toHaveBeenCalledWith(taskId, {
        actualMinutes: 0,
        status: 'pending',
      });
    });

    it('エントリが存在しない場合は何もしない', async () => {
      const entryId = 'entry-1';

      const mockedUpdate = vi.mocked(mockTimeEntryRepo.update);
      const mockedTaskUpdate = vi.mocked(mockTaskRepo.update);

      mockedUpdate.mockResolvedValue(null);

      const result = await timeEntryService.updateTimeEntry(entryId, { durationMinutes: 60 });

      expect(result).toBeNull();
      expect(mockedTaskUpdate).not.toHaveBeenCalled();
    });
  });

  describe('deleteTimeEntry', () => {
    it('時間記録を削除できる', async () => {
      const entryId = 'entry-1';

      const mockedDelete = vi.mocked(mockTimeEntryRepo.delete);

      mockedDelete.mockResolvedValue(true);

      const result = await timeEntryService.deleteTimeEntry(entryId);

      expect(result).toBe(true);
      expect(mockedDelete).toHaveBeenCalledWith(entryId);
    });
  });
});
