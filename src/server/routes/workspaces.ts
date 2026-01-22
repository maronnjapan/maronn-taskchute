import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { WorkspaceService } from '../services/workspace-service';
import { TaskService } from '../services/task-service';
import { WorkspaceRepository } from '../repositories/workspace-repository';
import { TaskRepository } from '../repositories/task-repository';
import { requireAuth } from '../middleware/auth';
import { notFoundError, forbiddenError } from '../middleware/error-handler';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  createTaskSchema,
  updateTaskSchema,
  reorderTasksSchema,
  carryOverTasksSchema,
} from '../../shared/validators/index';
import type { User, TaskStatus } from '../../shared/types/index';

type Bindings = {
  DB: D1Database;
};

type Variables = {
  user: User | null;
  userId: string | null;
};

const workspaces = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function getServices(db: D1Database) {
  const workspaceRepo = new WorkspaceRepository(db);
  const taskRepo = new TaskRepository(db);
  return {
    workspaceService: new WorkspaceService(workspaceRepo),
    taskService: new TaskService(taskRepo),
  };
}

// GET /api/workspaces - List user's workspaces
workspaces.get('/', requireAuth(), async (c) => {
  const userId = c.get('userId')!;
  const { workspaceService } = getServices(c.env.DB);

  const data = await workspaceService.getWorkspacesByOwner(userId);
  return c.json({ data });
});

// POST /api/workspaces - Create workspace
workspaces.post('/', requireAuth(), zValidator('json', createWorkspaceSchema), async (c) => {
  const userId = c.get('userId')!;
  const input = c.req.valid('json');
  const { workspaceService } = getServices(c.env.DB);

  const workspace = await workspaceService.createWorkspace(userId, input);
  return c.json({ data: workspace }, 201);
});

// GET /api/workspaces/:id - Get workspace by ID
workspaces.get('/:id', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const { workspaceService } = getServices(c.env.DB);

  const workspace = await workspaceService.getWorkspaceById(id);
  if (!workspace) {
    throw notFoundError('Workspace not found');
  }

  // Check access (owner or via share link)
  const canAccess = await workspaceService.canAccessWorkspace(id, userId);
  if (!canAccess) {
    throw forbiddenError('Access denied');
  }

  return c.json({ data: workspace });
});

// PATCH /api/workspaces/:id - Update workspace
workspaces.patch('/:id', requireAuth(), zValidator('json', updateWorkspaceSchema), async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId')!;
  const input = c.req.valid('json');
  const { workspaceService } = getServices(c.env.DB);

  const workspace = await workspaceService.updateWorkspace(id, userId, input);
  if (!workspace) {
    throw notFoundError('Workspace not found');
  }

  return c.json({ data: workspace });
});

// DELETE /api/workspaces/:id - Delete workspace
workspaces.delete('/:id', requireAuth(), async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId')!;
  const { workspaceService } = getServices(c.env.DB);

  const deleted = await workspaceService.deleteWorkspace(id, userId);
  if (!deleted) {
    throw notFoundError('Workspace not found');
  }

  return c.json({ data: { success: true } });
});

// POST /api/workspaces/:id/regenerate-token - Regenerate share token
workspaces.post('/:id/regenerate-token', requireAuth(), async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId')!;
  const { workspaceService } = getServices(c.env.DB);

  const workspace = await workspaceService.regenerateShareToken(id, userId);
  if (!workspace) {
    throw notFoundError('Workspace not found');
  }

  return c.json({ data: workspace });
});

// ============ Task routes under workspace ============

// GET /api/workspaces/:id/tasks - List tasks
workspaces.get('/:id/tasks', async (c) => {
  const workspaceId = c.req.param('id');
  const userId = c.get('userId');
  const date = c.req.query('date');
  const status = c.req.query('status') as TaskStatus | undefined;
  const { workspaceService, taskService } = getServices(c.env.DB);

  // Verify workspace access
  const canAccess = await workspaceService.canAccessWorkspace(workspaceId, userId);
  if (!canAccess) {
    throw forbiddenError('Access denied');
  }

  const tasks = await taskService.getTasksByWorkspace(workspaceId, { date, status });
  return c.json({ data: tasks });
});

// POST /api/workspaces/:id/tasks - Create task
workspaces.post('/:id/tasks', zValidator('json', createTaskSchema), async (c) => {
  const workspaceId = c.req.param('id');
  const userId = c.get('userId');
  const input = c.req.valid('json');
  const { workspaceService, taskService } = getServices(c.env.DB);

  // Verify workspace access
  const canAccess = await workspaceService.canAccessWorkspace(workspaceId, userId);
  if (!canAccess) {
    throw forbiddenError('Access denied');
  }

  const task = await taskService.createTask(workspaceId, input);
  return c.json({ data: task }, 201);
});

// GET /api/workspaces/:id/tasks/:taskId - Get task
workspaces.get('/:id/tasks/:taskId', async (c) => {
  const workspaceId = c.req.param('id');
  const taskId = c.req.param('taskId');
  const userId = c.get('userId');
  const { workspaceService, taskService } = getServices(c.env.DB);

  // Verify workspace access
  const canAccess = await workspaceService.canAccessWorkspace(workspaceId, userId);
  if (!canAccess) {
    throw forbiddenError('Access denied');
  }

  const task = await taskService.getTaskById(taskId);
  if (!task || task.workspaceId !== workspaceId) {
    throw notFoundError('Task not found');
  }

  return c.json({ data: task });
});

// PATCH /api/workspaces/:id/tasks/:taskId - Update task
workspaces.patch('/:id/tasks/:taskId', zValidator('json', updateTaskSchema), async (c) => {
  const workspaceId = c.req.param('id');
  const taskId = c.req.param('taskId');
  const userId = c.get('userId');
  const input = c.req.valid('json');
  const { workspaceService, taskService } = getServices(c.env.DB);

  // Verify workspace access
  const canAccess = await workspaceService.canAccessWorkspace(workspaceId, userId);
  if (!canAccess) {
    throw forbiddenError('Access denied');
  }

  // Verify task belongs to workspace
  const belongsTo = await taskService.belongsToWorkspace(taskId, workspaceId);
  if (!belongsTo) {
    throw notFoundError('Task not found');
  }

  const task = await taskService.updateTask(taskId, input);
  if (!task) {
    throw notFoundError('Task not found');
  }

  return c.json({ data: task });
});

// DELETE /api/workspaces/:id/tasks/:taskId - Delete task
workspaces.delete('/:id/tasks/:taskId', async (c) => {
  const workspaceId = c.req.param('id');
  const taskId = c.req.param('taskId');
  const userId = c.get('userId');
  const { workspaceService, taskService } = getServices(c.env.DB);

  // Verify workspace access
  const canAccess = await workspaceService.canAccessWorkspace(workspaceId, userId);
  if (!canAccess) {
    throw forbiddenError('Access denied');
  }

  // Verify task belongs to workspace
  const belongsTo = await taskService.belongsToWorkspace(taskId, workspaceId);
  if (!belongsTo) {
    throw notFoundError('Task not found');
  }

  const deleted = await taskService.deleteTask(taskId);
  if (!deleted) {
    throw notFoundError('Task not found');
  }

  return c.json({ data: { success: true } });
});

// POST /api/workspaces/:id/tasks/reorder - Reorder tasks
workspaces.post('/:id/tasks/reorder', zValidator('json', reorderTasksSchema), async (c) => {
  const workspaceId = c.req.param('id');
  const userId = c.get('userId');
  const input = c.req.valid('json');
  const { workspaceService, taskService } = getServices(c.env.DB);

  // Verify workspace access
  const canAccess = await workspaceService.canAccessWorkspace(workspaceId, userId);
  if (!canAccess) {
    throw forbiddenError('Access denied');
  }

  const tasks = await taskService.reorderTasks(workspaceId, input);
  return c.json({ data: tasks });
});

// POST /api/workspaces/:id/tasks/carry-over - Carry over tasks
workspaces.post('/:id/tasks/carry-over', zValidator('json', carryOverTasksSchema), async (c) => {
  const workspaceId = c.req.param('id');
  const userId = c.get('userId');
  const input = c.req.valid('json');
  const { workspaceService, taskService } = getServices(c.env.DB);

  // Verify workspace access
  const canAccess = await workspaceService.canAccessWorkspace(workspaceId, userId);
  if (!canAccess) {
    throw forbiddenError('Access denied');
  }

  const tasks = await taskService.carryOverTasks(workspaceId, input);
  return c.json({ data: tasks });
});

// GET /api/workspaces/:id/tasks/pending - Get pending tasks from past
workspaces.get('/:id/tasks/pending', async (c) => {
  const workspaceId = c.req.param('id');
  const userId = c.get('userId');
  const { workspaceService, taskService } = getServices(c.env.DB);

  // Verify workspace access
  const canAccess = await workspaceService.canAccessWorkspace(workspaceId, userId);
  if (!canAccess) {
    throw forbiddenError('Access denied');
  }

  const tasks = await taskService.getPendingTasksBeforeToday(workspaceId);
  return c.json({ data: tasks });
});

export default workspaces;
