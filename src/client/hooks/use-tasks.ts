import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi, timeEntryApi } from '../services/api-client';
import { useTaskStore } from '../stores/task-store';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  ReorderTasksInput,
} from '../../shared/validators/index';
import type { Task, TimeEntry } from '../../shared/types/index';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (workspaceId: string, filters?: { date?: string; status?: string }) =>
    [...taskKeys.lists(), workspaceId, filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (workspaceId: string, taskId: string) =>
    [...taskKeys.details(), workspaceId, taskId] as const,
};

export const timeEntryKeys = {
  all: ['timeEntries'] as const,
  lists: () => [...timeEntryKeys.all, 'list'] as const,
  list: (workspaceId: string, taskId: string) =>
    [...timeEntryKeys.lists(), workspaceId, taskId] as const,
  averageDuration: (workspaceId: string, taskId: string) =>
    [...timeEntryKeys.all, 'averageDuration', workspaceId, taskId] as const,
};

export function useTasks(workspaceId: string, options?: { date?: string; status?: string }) {
  const queryClient = useQueryClient();
  const { setTasks, addTask, updateTask, removeTask, reorderTasks } = useTaskStore();

  const listQuery = useQuery({
    queryKey: taskKeys.list(workspaceId, options),
    queryFn: async () => {
      const tasks = await taskApi.list(workspaceId, options);
      setTasks(tasks);
      return tasks;
    },
    enabled: Boolean(workspaceId),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTaskInput) => taskApi.create(workspaceId, input),
    onSuccess: (task) => {
      addTask(task);
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      taskApi.update(workspaceId, taskId, input),
    onSuccess: (task) => {
      updateTask(task.id, task);
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(workspaceId, task.id) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => taskApi.delete(workspaceId, taskId),
    onSuccess: (_, taskId) => {
      removeTask(taskId);
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (input: ReorderTasksInput) => taskApi.reorder(workspaceId, input),
    onMutate: (input) => {
      // Optimistic update
      reorderTasks(input.taskIds);
    },
    onSuccess: (updatedTasks) => {
      // Update store with the server response
      updatedTasks.forEach(task => {
        updateTask(task.id, task);
      });
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
    onError: () => {
      // Revert on error by refetching
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });

  return {
    tasks: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    reorder: reorderMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isReordering: reorderMutation.isPending,
  };
}

export function useTask(workspaceId: string, taskId: string) {
  return useQuery({
    queryKey: taskKeys.detail(workspaceId, taskId),
    queryFn: () => taskApi.get(workspaceId, taskId),
    enabled: Boolean(workspaceId) && Boolean(taskId),
  });
}

export function useTasksByShareToken(
  shareToken: string,
  options?: { date?: string; status?: string }
) {
  return useQuery({
    queryKey: ['shared-tasks', shareToken, options] as const,
    queryFn: () => taskApi.listByShareToken(shareToken, options),
    enabled: Boolean(shareToken),
  });
}

// Time Entry Hooks
export function useTimeEntries(workspaceId: string, taskId: string) {
  const queryClient = useQueryClient();
  const { updateTask } = useTaskStore();

  const listQuery = useQuery({
    queryKey: timeEntryKeys.list(workspaceId, taskId),
    queryFn: () => timeEntryApi.list(workspaceId, taskId),
    enabled: Boolean(workspaceId) && Boolean(taskId),
  });

  const startMutation = useMutation({
    mutationFn: () => timeEntryApi.start(workspaceId, taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: timeEntryKeys.list(workspaceId, taskId) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });

  const stopMutation = useMutation({
    mutationFn: (timeEntryId: string) => timeEntryApi.stop(workspaceId, taskId, timeEntryId),
    onSuccess: async () => {
      // Immediately refetch the task to get updated actualMinutes
      try {
        const updatedTask = await taskApi.get(workspaceId, taskId);
        updateTask(updatedTask.id, updatedTask);
      } catch (error) {
        console.error('Failed to refetch task after stopping time entry:', error);
      }
      void queryClient.invalidateQueries({ queryKey: timeEntryKeys.list(workspaceId, taskId) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });

  return {
    timeEntries: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    start: startMutation.mutate,
    stop: stopMutation.mutate,
    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
  };
}

export function useAverageDuration(workspaceId: string, taskId: string) {
  return useQuery({
    queryKey: timeEntryKeys.averageDuration(workspaceId, taskId),
    queryFn: () => timeEntryApi.getAverageDuration(workspaceId, taskId),
    enabled: Boolean(workspaceId) && Boolean(taskId),
  });
}

export function useAverageDurationByTitle(workspaceId: string, title: string | undefined) {
  return useQuery({
    queryKey: ['averageDuration', 'byTitle', workspaceId, title] as const,
    queryFn: () => timeEntryApi.getAverageDurationByTitle(workspaceId, title!),
    enabled: Boolean(workspaceId) && Boolean(title),
  });
}

// Hook to fetch all active time entries for a workspace
export function useActiveTimeEntries(workspaceId: string, tasks: Task[]) {
  return useQuery({
    queryKey: ['activeTimeEntries', workspaceId, tasks.map(t => t.id).join(',')] as const,
    queryFn: async () => {
      if (tasks.length === 0) {
        return new Map<string, TimeEntry>();
      }

      const activeEntries = new Map<string, TimeEntry>();

      // Fetch time entries for all tasks in parallel
      await Promise.all(
        tasks.map(async (task) => {
          try {
            const entries = await timeEntryApi.list(workspaceId, task.id);
            // Find active entry (endedAt is null)
            const activeEntry = entries.find((entry) => !entry.endedAt);
            if (activeEntry) {
              activeEntries.set(task.id, activeEntry);
            }
          } catch (error) {
            console.error(`Failed to fetch time entries for task ${task.id}:`, error);
          }
        })
      );

      return activeEntries;
    },
    enabled: Boolean(workspaceId) && tasks.length > 0,
    staleTime: 0, // Always fetch fresh data to ensure we have the latest state
  });
}
