import { Hono } from 'hono';
import { WorkspaceService } from '../services/workspace-service';
import { TaskService } from '../services/task-service';
import { WorkspaceRepository } from '../repositories/workspace-repository';
import { TaskRepository } from '../repositories/task-repository';
import { notFoundError } from '../middleware/error-handler';
import type { TaskStatus } from '../../shared/types/index';

type Bindings = {
  DB: D1Database;
};

const share = new Hono<{ Bindings: Bindings }>();

function getServices(db: D1Database) {
  const workspaceRepo = new WorkspaceRepository(db);
  const taskRepo = new TaskRepository(db);
  return {
    workspaceService: new WorkspaceService(workspaceRepo),
    taskService: new TaskService(taskRepo),
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

export default share;
