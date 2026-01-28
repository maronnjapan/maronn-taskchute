import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { WorkspaceService } from '../services/workspace-service';
import { TaskService } from '../services/task-service';
import { TimeEntryService } from '../services/time-entry-service';
import { WorkspaceRepository } from '../repositories/workspace-repository';
import { TaskRepository } from '../repositories/task-repository';
import { TimeEntryRepository } from '../repositories/time-entry-repository';
import { notFoundError } from '../middleware/error-handler';
import {
  createTaskSchema,
  updateTaskSchema,
  reorderTasksSchema,
  updateTimeEntrySchema,
} from '../../shared/validators/index';
import type { TaskStatus } from '../../shared/types/index';

interface Bindings {
  DB: D1Database;
}

const share = new Hono<{ Bindings: Bindings }>();

function getServices(db: D1Database) {
  const workspaceRepo = new WorkspaceRepository(db);
  const taskRepo = new TaskRepository(db);
  const timeEntryRepo = new TimeEntryRepository(db);
  return {
    workspaceService: new WorkspaceService(workspaceRepo),
    taskService: new TaskService(taskRepo, timeEntryRepo),
    timeEntryService: new TimeEntryService(timeEntryRepo, taskRepo),
  };
}

// GET /api/s/:shareToken - Get workspace by share token
share.get('/:shareToken', async (c) => {
  const shareToken = c.req.param('shareToken');
  const { workspaceService } = getServices(c.env.DB);

  const workspace = await workspaceService.getWorkspaceByShareToken(shareToken);
  if (!workspace) {
    throw notFoundError('Shared workspace not found');
  }

  return c.json({ data: workspace });
});

// GET /api/s/:shareToken/tasks - Get tasks for shared workspace
share.get('/:shareToken/tasks', async (c) => {
  const shareToken = c.req.param('shareToken');
  const date = c.req.query('date');
  const status = c.req.query('status') as TaskStatus | undefined;
  const { workspaceService, taskService } = getServices(c.env.DB);

  const workspace = await workspaceService.getWorkspaceByShareToken(shareToken);
  if (!workspace) {
    throw notFoundError('Shared workspace not found');
  }

  const tasks = await taskService.getTasksByWorkspace(workspace.id, { date, status });
  return c.json({ data: tasks });
});

// POST /api/s/:shareToken/tasks - Create task in shared workspace
share.post('/:shareToken/tasks', zValidator('json', createTaskSchema), async (c) => {
  const shareToken = c.req.param('shareToken');
  const input = c.req.valid('json');
  const { workspaceService, taskService } = getServices(c.env.DB);

  const workspace = await workspaceService.getWorkspaceByShareToken(shareToken);
  if (!workspace) {
    throw notFoundError('Shared workspace not found');
  }

  const task = await taskService.createTask(workspace.id, input);
  return c.json({ data: task }, 201);
});

// PATCH /api/s/:shareToken/tasks/:taskId - Update task in shared workspace
share.patch('/:shareToken/tasks/:taskId', zValidator('json', updateTaskSchema), async (c) => {
  const shareToken = c.req.param('shareToken');
  const taskId = c.req.param('taskId');
  const input = c.req.valid('json');
  const { workspaceService, taskService } = getServices(c.env.DB);

  const workspace = await workspaceService.getWorkspaceByShareToken(shareToken);
  if (!workspace) {
    throw notFoundError('Shared workspace not found');
  }

  const belongsTo = await taskService.belongsToWorkspace(taskId, workspace.id);
  if (!belongsTo) {
    throw notFoundError('Task not found');
  }

  const task = await taskService.updateTask(taskId, input);
  if (!task) {
    throw notFoundError('Task not found');
  }

  return c.json({ data: task });
});

// DELETE /api/s/:shareToken/tasks/:taskId - Delete task in shared workspace
share.delete('/:shareToken/tasks/:taskId', async (c) => {
  const shareToken = c.req.param('shareToken');
  const taskId = c.req.param('taskId');
  const { workspaceService, taskService } = getServices(c.env.DB);

  const workspace = await workspaceService.getWorkspaceByShareToken(shareToken);
  if (!workspace) {
    throw notFoundError('Shared workspace not found');
  }

  const belongsTo = await taskService.belongsToWorkspace(taskId, workspace.id);
  if (!belongsTo) {
    throw notFoundError('Task not found');
  }

  const deleted = await taskService.deleteTask(taskId);
  if (!deleted) {
    throw notFoundError('Task not found');
  }

  return c.json({ data: { success: true } });
});

// POST /api/s/:shareToken/tasks/reorder - Reorder tasks in shared workspace
share.post('/:shareToken/tasks/reorder', zValidator('json', reorderTasksSchema), async (c) => {
  const shareToken = c.req.param('shareToken');
  const input = c.req.valid('json');
  const { workspaceService, taskService } = getServices(c.env.DB);

  const workspace = await workspaceService.getWorkspaceByShareToken(shareToken);
  if (!workspace) {
    throw notFoundError('Shared workspace not found');
  }

  const tasks = await taskService.reorderTasks(workspace.id, input);
  return c.json({ data: tasks });
});

// ============ Time Entry routes for shared workspace ============

// POST /api/s/:shareToken/tasks/:taskId/time-entries/start - Start time tracking
share.post('/:shareToken/tasks/:taskId/time-entries/start', async (c) => {
  const shareToken = c.req.param('shareToken');
  const taskId = c.req.param('taskId');
  const { workspaceService, taskService, timeEntryService } = getServices(c.env.DB);

  const workspace = await workspaceService.getWorkspaceByShareToken(shareToken);
  if (!workspace) {
    throw notFoundError('Shared workspace not found');
  }

  const belongsTo = await taskService.belongsToWorkspace(taskId, workspace.id);
  if (!belongsTo) {
    throw notFoundError('Task not found');
  }

  const timeEntry = await timeEntryService.startTimeEntry(taskId);
  return c.json({ data: timeEntry }, 201);
});

// POST /api/s/:shareToken/tasks/:taskId/time-entries/:timeEntryId/stop - Stop time tracking
share.post('/:shareToken/tasks/:taskId/time-entries/:timeEntryId/stop', async (c) => {
  const shareToken = c.req.param('shareToken');
  const taskId = c.req.param('taskId');
  const timeEntryId = c.req.param('timeEntryId');
  const { workspaceService, taskService, timeEntryService } = getServices(c.env.DB);

  const workspace = await workspaceService.getWorkspaceByShareToken(shareToken);
  if (!workspace) {
    throw notFoundError('Shared workspace not found');
  }

  const belongsTo = await taskService.belongsToWorkspace(taskId, workspace.id);
  if (!belongsTo) {
    throw notFoundError('Task not found');
  }

  const timeEntry = await timeEntryService.stopTimeEntry(timeEntryId);
  if (!timeEntry) {
    throw notFoundError('Time entry not found');
  }

  return c.json({ data: timeEntry });
});

// PATCH /api/s/:shareToken/tasks/:taskId/time-entries/:timeEntryId - Update time entry
share.patch(
  '/:shareToken/tasks/:taskId/time-entries/:timeEntryId',
  zValidator('json', updateTimeEntrySchema),
  async (c) => {
    const shareToken = c.req.param('shareToken');
    const taskId = c.req.param('taskId');
    const timeEntryId = c.req.param('timeEntryId');
    const input = c.req.valid('json');
    const { workspaceService, taskService, timeEntryService } = getServices(c.env.DB);

    const workspace = await workspaceService.getWorkspaceByShareToken(shareToken);
    if (!workspace) {
      throw notFoundError('Shared workspace not found');
    }

    const belongsTo = await taskService.belongsToWorkspace(taskId, workspace.id);
    if (!belongsTo) {
      throw notFoundError('Task not found');
    }

    const existingEntry = await timeEntryService.getTimeEntryById(timeEntryId);
    if (existingEntry?.taskId !== taskId) {
      throw notFoundError('Time entry not found');
    }

    const timeEntry = await timeEntryService.updateTimeEntry(timeEntryId, input);
    if (!timeEntry) {
      throw notFoundError('Time entry not found');
    }

    return c.json({ data: timeEntry });
  }
);

// GET /api/s/:shareToken/tasks/:taskId/time-entries - Get time entries for a task
share.get('/:shareToken/tasks/:taskId/time-entries', async (c) => {
  const shareToken = c.req.param('shareToken');
  const taskId = c.req.param('taskId');
  const date = c.req.query('date');
  const { workspaceService, taskService, timeEntryService } = getServices(c.env.DB);

  const workspace = await workspaceService.getWorkspaceByShareToken(shareToken);
  if (!workspace) {
    throw notFoundError('Shared workspace not found');
  }

  const belongsTo = await taskService.belongsToWorkspace(taskId, workspace.id);
  if (!belongsTo) {
    throw notFoundError('Task not found');
  }

  const timeEntries = await timeEntryService.getTimeEntriesByTaskId(taskId, date ?? undefined);
  return c.json({ data: timeEntries });
});

export default share;
