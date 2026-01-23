import type {
  Task,
  Workspace,
  TaskComment,
  AuthUser,
  ApiResponse,
  TimeEntry,
} from '../../shared/types/index';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  CreateTaskCommentInput,
  UpdateTaskCommentInput,
  ReorderTasksInput,
} from '../../shared/validators/index';

const BASE_URL = '';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as { error?: { message?: string } };
    throw new Error(error.error?.message ?? `HTTP error ${response.status}`);
  }
  return response.json();
}

// Auth API
export const authApi = {
  async getMe(): Promise<AuthUser | null> {
    const response = await fetch(`${BASE_URL}/auth/me`, { credentials: 'include' });
    const result = await handleResponse<ApiResponse<AuthUser | null>>(response);
    return result.data;
  },

  async logout(): Promise<{ logoutUrl: string }> {
    const response = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ logoutUrl: string }>(response);
  },

  getLoginUrl(): string {
    return `${BASE_URL}/auth/login`;
  },
};

// Workspace API
export const workspaceApi = {
  async list(): Promise<Workspace[]> {
    const response = await fetch(`${BASE_URL}/api/workspaces`, { credentials: 'include' });
    const result = await handleResponse<ApiResponse<Workspace[]>>(response);
    return result.data;
  },

  async get(id: string): Promise<Workspace> {
    const response = await fetch(`${BASE_URL}/api/workspaces/${id}`, { credentials: 'include' });
    const result = await handleResponse<ApiResponse<Workspace>>(response);
    return result.data;
  },

  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    const response = await fetch(`${BASE_URL}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const result = await handleResponse<ApiResponse<Workspace>>(response);
    return result.data;
  },

  async update(id: string, input: UpdateWorkspaceInput): Promise<Workspace> {
    const response = await fetch(`${BASE_URL}/api/workspaces/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const result = await handleResponse<ApiResponse<Workspace>>(response);
    return result.data;
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/api/workspaces/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await handleResponse<ApiResponse<{ success: boolean }>>(response);
  },

  async regenerateToken(id: string): Promise<Workspace> {
    const response = await fetch(`${BASE_URL}/api/workspaces/${id}/regenerate-token`, {
      method: 'POST',
      credentials: 'include',
    });
    const result = await handleResponse<ApiResponse<Workspace>>(response);
    return result.data;
  },

  async getByShareToken(shareToken: string): Promise<Workspace> {
    const response = await fetch(`${BASE_URL}/api/s/${shareToken}`, { credentials: 'include' });
    const result = await handleResponse<ApiResponse<Workspace>>(response);
    return result.data;
  },
};

// Task API
export const taskApi = {
  async list(workspaceId: string, options?: { date?: string; status?: string }): Promise<Task[]> {
    const params = new URLSearchParams();
    if (options?.date) params.set('date', options.date);
    if (options?.status) params.set('status', options.status);
    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/tasks${query}`, {
      credentials: 'include',
    });
    const result = await handleResponse<ApiResponse<Task[]>>(response);
    return result.data;
  },

  async get(workspaceId: string, taskId: string): Promise<Task> {
    const response = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/tasks/${taskId}`, {
      credentials: 'include',
    });
    const result = await handleResponse<ApiResponse<Task>>(response);
    return result.data;
  },

  async create(workspaceId: string, input: CreateTaskInput): Promise<Task> {
    const response = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const result = await handleResponse<ApiResponse<Task>>(response);
    return result.data;
  },

  async update(workspaceId: string, taskId: string, input: UpdateTaskInput): Promise<Task> {
    const response = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const result = await handleResponse<ApiResponse<Task>>(response);
    return result.data;
  },

  async delete(workspaceId: string, taskId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/tasks/${taskId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await handleResponse<ApiResponse<{ success: boolean }>>(response);
  },

  async reorder(workspaceId: string, input: ReorderTasksInput): Promise<Task[]> {
    const response = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/tasks/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const result = await handleResponse<ApiResponse<Task[]>>(response);
    return result.data;
  },

  async listByShareToken(shareToken: string, options?: { date?: string; status?: string }): Promise<Task[]> {
    const params = new URLSearchParams();
    if (options?.date) params.set('date', options.date);
    if (options?.status) params.set('status', options.status);
    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${BASE_URL}/api/s/${shareToken}/tasks${query}`, {
      credentials: 'include',
    });
    const result = await handleResponse<ApiResponse<Task[]>>(response);
    return result.data;
  },
};

// Time Entry API
export const timeEntryApi = {
  async list(workspaceId: string, taskId: string): Promise<TimeEntry[]> {
    const response = await fetch(
      `${BASE_URL}/api/workspaces/${workspaceId}/tasks/${taskId}/time-entries`,
      { credentials: 'include' }
    );
    const result = await handleResponse<ApiResponse<TimeEntry[]>>(response);
    return result.data;
  },

  async start(workspaceId: string, taskId: string): Promise<TimeEntry> {
    const response = await fetch(
      `${BASE_URL}/api/workspaces/${workspaceId}/tasks/${taskId}/time-entries/start`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );
    const result = await handleResponse<ApiResponse<TimeEntry>>(response);
    return result.data;
  },

  async stop(workspaceId: string, taskId: string, timeEntryId: string): Promise<TimeEntry> {
    const response = await fetch(
      `${BASE_URL}/api/workspaces/${workspaceId}/tasks/${taskId}/time-entries/${timeEntryId}/stop`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );
    const result = await handleResponse<ApiResponse<TimeEntry>>(response);
    return result.data;
  },

  async getAverageDuration(workspaceId: string, taskId: string): Promise<number | null> {
    const response = await fetch(
      `${BASE_URL}/api/workspaces/${workspaceId}/tasks/${taskId}/average-duration`,
      { credentials: 'include' }
    );
    const result = await handleResponse<ApiResponse<{ averageDuration: number | null }>>(response);
    return result.data.averageDuration;
  },
};

// Comment API
export const commentApi = {
  async list(taskId: string): Promise<TaskComment[]> {
    const response = await fetch(`${BASE_URL}/api/tasks/${taskId}/comments`, {
      credentials: 'include',
    });
    const result = await handleResponse<ApiResponse<TaskComment[]>>(response);
    return result.data;
  },

  async create(taskId: string, input: CreateTaskCommentInput): Promise<TaskComment> {
    const response = await fetch(`${BASE_URL}/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const result = await handleResponse<ApiResponse<TaskComment>>(response);
    return result.data;
  },

  async update(commentId: string, input: UpdateTaskCommentInput): Promise<TaskComment> {
    const response = await fetch(`${BASE_URL}/api/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const result = await handleResponse<ApiResponse<TaskComment>>(response);
    return result.data;
  },

  async delete(commentId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/api/comments/${commentId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await handleResponse<ApiResponse<{ success: boolean }>>(response);
  },
};
