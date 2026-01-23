import type { TimeEntryRepository } from '../repositories/time-entry-repository';
import type { TaskRepository } from '../repositories/task-repository';
import type { TimeEntry } from '../../shared/types/index';

export class TimeEntryService {
  constructor(
    private timeEntryRepo: TimeEntryRepository,
    private taskRepo: TaskRepository
  ) {}

  async getTimeEntriesByTaskId(taskId: string): Promise<TimeEntry[]> {
    return this.timeEntryRepo.findByTaskId(taskId);
  }

  async getActiveTimeEntry(taskId: string): Promise<TimeEntry | null> {
    return this.timeEntryRepo.findActiveByTaskId(taskId);
  }

  async startTimeEntry(taskId: string): Promise<TimeEntry> {
    // Update task status to in_progress
    await this.taskRepo.update(taskId, { status: 'in_progress' });
    return this.timeEntryRepo.start(taskId);
  }

  async stopTimeEntry(timeEntryId: string): Promise<TimeEntry | null> {
    const entry = await this.timeEntryRepo.stop(timeEntryId);
    if (entry) {
      // Update task's actual minutes with total duration
      const totalDuration = await this.timeEntryRepo.getTotalDurationByTaskId(entry.taskId);
      await this.taskRepo.update(entry.taskId, {
        actualMinutes: totalDuration,
        status: 'pending', // Reset to pending when stopped
      });
    }
    return entry;
  }

  async getTotalDuration(taskId: string): Promise<number> {
    return this.timeEntryRepo.getTotalDurationByTaskId(taskId);
  }

  async getAverageDuration(workspaceId: string, title: string): Promise<number | null> {
    return this.timeEntryRepo.getAverageDurationByTaskTitle(workspaceId, title);
  }

  async deleteTimeEntry(id: string): Promise<boolean> {
    return this.timeEntryRepo.delete(id);
  }

  async updateTimeEntry(
    timeEntryId: string,
    input: { startedAt?: number; endedAt?: number | null; durationMinutes?: number | null }
  ): Promise<TimeEntry | null> {
    const entry = await this.timeEntryRepo.update(timeEntryId, input);

    if (entry) {
      // Recalculate task's actual minutes with total duration
      const totalDuration = await this.timeEntryRepo.getTotalDurationByTaskId(entry.taskId);
      await this.taskRepo.update(entry.taskId, {
        actualMinutes: totalDuration,
      });
    }

    return entry;
  }

  async getTimeEntryById(id: string): Promise<TimeEntry | null> {
    return this.timeEntryRepo.findById(id);
  }

  async getTimeEntriesByTaskIds(taskIds: string[]): Promise<Map<string, TimeEntry[]>> {
    return this.timeEntryRepo.findByTaskIds(taskIds);
  }

  // Check if a task has an active (running) time entry
  async hasActiveTimeEntry(taskId: string): Promise<boolean> {
    const active = await this.timeEntryRepo.findActiveByTaskId(taskId);
    return active !== null;
  }
}
