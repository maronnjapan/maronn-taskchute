import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { TaskCommentService } from '../services/task-comment-service';
import { TaskService } from '../services/task-service';
import { WorkspaceService } from '../services/workspace-service';
import { TaskCommentRepository } from '../repositories/task-comment-repository';
import { TaskRepository } from '../repositories/task-repository';
import { WorkspaceRepository } from '../repositories/workspace-repository';
import { notFoundError, forbiddenError } from '../middleware/error-handler';
import {
  createTaskCommentSchema,
  updateTaskCommentSchema,
} from '../../shared/validators/index';
import type { User } from '../../shared/types/index';

interface Bindings {
  DB: D1Database;
}

interface Variables {
  user: User | null;
  userId: string | null;
}

const comments = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function getServices(db: D1Database) {
  const commentRepo = new TaskCommentRepository(db);
  const taskRepo = new TaskRepository(db);
  const workspaceRepo = new WorkspaceRepository(db);
  return {
    commentService: new TaskCommentService(commentRepo, taskRepo),
    taskService: new TaskService(taskRepo),
    workspaceService: new WorkspaceService(workspaceRepo),
  };
}

// GET /api/tasks/:taskId/comments - List comments for a task
comments.get('/tasks/:taskId/comments', async (c) => {
  const taskId = c.req.param('taskId');
  const userId = c.get('userId');
  const { commentService, taskService, workspaceService } = getServices(c.env.DB);

  // Get task to verify access
  const task = await taskService.getTaskById(taskId);
  if (!task) {
    throw notFoundError('Task not found');
  }

  // Verify workspace access
  const canAccess = await workspaceService.canAccessWorkspace(task.workspaceId, userId);
  if (!canAccess) {
    throw forbiddenError('Access denied');
  }

  const data = await commentService.getCommentsByTask(taskId);
  return c.json({ data });
});

// POST /api/tasks/:taskId/comments - Create comment
comments.post('/tasks/:taskId/comments', zValidator('json', createTaskCommentSchema), async (c) => {
  const taskId = c.req.param('taskId');
  const userId = c.get('userId');
  const input = c.req.valid('json');
  const { commentService, taskService, workspaceService } = getServices(c.env.DB);

  // Get task to verify access
  const task = await taskService.getTaskById(taskId);
  if (!task) {
    throw notFoundError('Task not found');
  }

  // Verify workspace access
  const canAccess = await workspaceService.canAccessWorkspace(task.workspaceId, userId);
  if (!canAccess) {
    throw forbiddenError('Access denied');
  }

  const comment = await commentService.createComment(taskId, input);
  return c.json({ data: comment }, 201);
});

// PATCH /api/comments/:commentId - Update comment
comments.patch('/comments/:commentId', zValidator('json', updateTaskCommentSchema), async (c) => {
  const commentId = c.req.param('commentId');
  const userId = c.get('userId');
  const input = c.req.valid('json');
  const { commentService, taskService, workspaceService } = getServices(c.env.DB);

  // Get comment to verify access
  const existingComment = await commentService.getCommentById(commentId);
  if (!existingComment) {
    throw notFoundError('Comment not found');
  }

  // Get task to verify workspace access
  const task = await taskService.getTaskById(existingComment.taskId);
  if (!task) {
    throw notFoundError('Task not found');
  }

  // Verify workspace access
  const canAccess = await workspaceService.canAccessWorkspace(task.workspaceId, userId);
  if (!canAccess) {
    throw forbiddenError('Access denied');
  }

  const comment = await commentService.updateComment(commentId, input);
  if (!comment) {
    throw notFoundError('Comment not found');
  }

  return c.json({ data: comment });
});

// DELETE /api/comments/:commentId - Delete comment
comments.delete('/comments/:commentId', async (c) => {
  const commentId = c.req.param('commentId');
  const userId = c.get('userId');
  const { commentService, taskService, workspaceService } = getServices(c.env.DB);

  // Get comment to verify access
  const existingComment = await commentService.getCommentById(commentId);
  if (!existingComment) {
    throw notFoundError('Comment not found');
  }

  // Get task to verify workspace access
  const task = await taskService.getTaskById(existingComment.taskId);
  if (!task) {
    throw notFoundError('Task not found');
  }

  // Verify workspace access
  const canAccess = await workspaceService.canAccessWorkspace(task.workspaceId, userId);
  if (!canAccess) {
    throw forbiddenError('Access denied');
  }

  const deleted = await commentService.deleteComment(commentId);
  if (!deleted) {
    throw notFoundError('Comment not found');
  }

  return c.json({ data: { success: true } });
});

export default comments;
