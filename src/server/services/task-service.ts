import type { TaskRepository } from '../repositories/task-repository';
import type { Task, TaskStatus } from '../../shared/types/index';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  ReorderTasksInput,
} from '../../shared/validators/index';

export class TaskService {
  constructor(private taskRepo: TaskRepository) {}

  async getTasksByWorkspace(
    workspaceId: string,
    options?: { date?: string; status?: TaskStatus }
  ): Promise<Task[]> {
    return this.taskRepo.findByWorkspaceId(workspaceId, options);
  }

  async getTaskById(id: string): Promise<Task | null> {
    return this.taskRepo.findById(id);
  }

  async createTask(workspaceId: string, input: CreateTaskInput): Promise<Task> {
    return this.taskRepo.create({
      workspaceId,
      title: input.title,
      description: input.description,
      scheduledDate: input.scheduledDate,
      estimatedMinutes: input.estimatedMinutes,
      sortOrder: input.sortOrder,
      repeatPattern: input.repeatPattern,
    });
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task | null> {
    return this.taskRepo.update(id, {
      title: input.title,
      description: input.description,
      scheduledDate: input.scheduledDate,
      estimatedMinutes: input.estimatedMinutes,
      actualMinutes: input.actualMinutes,
      status: input.status,
      sortOrder: input.sortOrder,
      repeatPattern: input.repeatPattern,
      repeatEndDate: input.repeatEndDate,
    });
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.taskRepo.delete(id);
  }

  async startTask(id: string): Promise<Task | null> {
    return this.taskRepo.update(id, { status: 'in_progress' });
  }

  async stopTask(id: string): Promise<Task | null> {
    return this.taskRepo.update(id, { status: 'pending' });
  }

  async reorderTasks(workspaceId: string, input: ReorderTasksInput): Promise<Task[]> {
    // Verify all tasks belong to the workspace
    for (const taskId of input.taskIds) {
      const belongsTo = await this.taskRepo.belongsToWorkspace(taskId, workspaceId);
      if (!belongsTo) {
        throw new Error(`Task ${taskId} does not belong to workspace ${workspaceId}`);
      }
    }

    // Update sort orders
    const taskOrders = input.taskIds.map((id, index) => ({
      id,
      sortOrder: index,
    }));

    await this.taskRepo.updateSortOrders(taskOrders);

    // Return updated tasks
    return Promise.all(input.taskIds.map(id => this.taskRepo.findById(id))).then(
      tasks => tasks.filter((t): t is Task => t !== null)
    );
  }

  async belongsToWorkspace(taskId: string, workspaceId: string): Promise<boolean> {
    return this.taskRepo.belongsToWorkspace(taskId, workspaceId);
  }

  // End repeat for a task from a specific date
  async endRepeat(id: string, endDate: string): Promise<Task | null> {
    return this.taskRepo.endRepeat(id, endDate);
  }

  // Remove repeat pattern entirely
  async removeRepeat(id: string): Promise<Task | null> {
    return this.taskRepo.removeRepeat(id);
  }

  // Get all repeating tasks for a workspace
  async getRepeatingTasks(workspaceId: string): Promise<Task[]> {
    return this.taskRepo.findRepeatingByWorkspaceId(workspaceId);
  }
}
