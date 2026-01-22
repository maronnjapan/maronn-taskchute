// Re-export all types from the main types file
export type {
  User,
  Workspace,
  TaskStatus,
  Task,
  TaskComment,
  Session,
  ApiResponse,
  ApiError,
  AuthUser,
} from './index';

// Re-export input types from validators (these are inferred from zod schemas)
export type {
  CreateTaskInput,
  UpdateTaskInput,
  ReorderTasksInput,
  CarryOverTasksInput,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  CreateTaskCommentInput,
  UpdateTaskCommentInput,
  TaskQueryParams,
} from '../validators/index';

// Re-export schemas for validation
export {
  createTaskSchema,
  updateTaskSchema,
  reorderTasksSchema,
  carryOverTasksSchema,
  createWorkspaceSchema,
  updateWorkspaceSchema,
  createTaskCommentSchema,
  updateTaskCommentSchema,
  taskQuerySchema,
  taskStatusSchema,
} from '../validators/index';

// Re-export utils
export * from '../utils/index';

// Re-export constants
export * from '../constants/index';
