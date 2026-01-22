// User (cached from Auth0)
export interface User {
  id: string;
  auth0Id: string;
  email: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

// Workspace (share link unit)
export interface Workspace {
  id: string;
  ownerId: string;
  shareToken: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

// Task
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'carried_over';

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  scheduledDate: string; // YYYY-MM-DD
  sortOrder: number;
  estimatedMinutes?: number;
  actualMinutes?: number;
  startedAt?: number;
  completedAt?: number;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
}

// Task Comment
export interface TaskComment {
  id: string;
  taskId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// Session
export interface Session {
  id: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    hasMore?: boolean;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}
