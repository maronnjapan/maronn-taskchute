import { z } from 'zod';

// Task status enum
export const taskStatusSchema = z.enum(['pending', 'in_progress']);

// Repeat pattern enum
export const repeatPatternSchema = z.enum(['daily', 'weekdays', 'weekly', 'monthly']);

// Date format validation (YYYY-MM-DD)
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD');

// Optional minutes schema that handles NaN from empty number inputs
const optionalMinutesSchema = z
  .union([z.number(), z.nan(), z.undefined()])
  .transform(val => Number.isNaN(val) ? undefined : val)
  .pipe(z.number().int().min(0).max(1440, 'Estimated minutes must be between 0 and 1440').optional());

// Task schemas
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: z.string().max(10000, 'Description must be 10000 characters or less').optional(),
  scheduledDate: dateStringSchema,
  estimatedMinutes: optionalMinutesSchema,
  sortOrder: z.number().int().optional(),
  repeatPattern: repeatPatternSchema.optional(),
});

// Nullable optional minutes schema for updates (handles NaN and null)
const nullableOptionalMinutesSchema = z
  .union([z.number(), z.nan(), z.null(), z.undefined()])
  .transform(val => Number.isNaN(val) ? undefined : val)
  .pipe(z.number().int().min(0).max(1440, 'Actual minutes must be between 0 and 1440').nullable().optional());

export const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less').optional(),
  description: z.string().max(10000, 'Description must be 10000 characters or less').nullable().optional(),
  scheduledDate: dateStringSchema.optional(),
  estimatedMinutes: nullableOptionalMinutesSchema,
  actualMinutes: nullableOptionalMinutesSchema,
  status: taskStatusSchema.optional(),
  sortOrder: z.number().int().optional(),
  repeatPattern: repeatPatternSchema.nullable().optional(),
  repeatEndDate: dateStringSchema.nullable().optional(),
});

export const reorderTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()),
});

// Time entry schemas
export const startTimeEntrySchema = z.object({
  taskId: z.string().uuid(),
});

export const stopTimeEntrySchema = z.object({
  timeEntryId: z.string().uuid(),
});

export const updateTimeEntrySchema = z.object({
  startedAt: z.number().int().positive().optional(),
  endedAt: z.number().int().positive().nullable().optional(),
  durationMinutes: z.number().int().min(0).max(1440).nullable().optional(),
});

// Workspace schemas
export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').optional(),
});

// Task comment schemas
export const createTaskCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be 10000 characters or less'),
});

export const updateTaskCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be 10000 characters or less'),
});

// Query params schemas
export const taskQuerySchema = z.object({
  date: dateStringSchema.optional(),
  status: taskStatusSchema.optional(),
});

// Export types from schemas
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ReorderTasksInput = z.infer<typeof reorderTasksSchema>;
export type StartTimeEntryInput = z.infer<typeof startTimeEntrySchema>;
export type StopTimeEntryInput = z.infer<typeof stopTimeEntrySchema>;
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;
export type UpdateTaskCommentInput = z.infer<typeof updateTaskCommentSchema>;
export type TaskQueryParams = z.infer<typeof taskQuerySchema>;
