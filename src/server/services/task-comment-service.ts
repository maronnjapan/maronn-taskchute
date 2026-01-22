import type { TaskCommentRepository } from '../repositories/task-comment-repository';
import type { TaskRepository } from '../repositories/task-repository';
import type { TaskComment } from '../../shared/types/index';
import type {
  CreateTaskCommentInput,
  UpdateTaskCommentInput,
} from '../../shared/validators/index';

export class TaskCommentService {
  constructor(
    private commentRepo: TaskCommentRepository,
    private taskRepo: TaskRepository
  ) {}

  async getCommentsByTask(taskId: string): Promise<TaskComment[]> {
    return this.commentRepo.findByTaskId(taskId);
  }

  async getCommentById(id: string): Promise<TaskComment | null> {
    return this.commentRepo.findById(id);
  }

  async createComment(taskId: string, input: CreateTaskCommentInput): Promise<TaskComment> {
    // Verify task exists
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    return this.commentRepo.create({
      taskId,
      content: input.content,
    });
  }

  async updateComment(id: string, input: UpdateTaskCommentInput): Promise<TaskComment | null> {
    return this.commentRepo.update(id, input.content);
  }

  async deleteComment(id: string): Promise<boolean> {
    return this.commentRepo.delete(id);
  }

  async getTaskIdForComment(commentId: string): Promise<string | null> {
    const comment = await this.commentRepo.findById(commentId);
    return comment?.taskId ?? null;
  }
}
