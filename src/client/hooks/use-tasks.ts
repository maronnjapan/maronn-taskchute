import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi } from '../services/api-client';
import { useTaskStore } from '../stores/task-store';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  ReorderTasksInput,
  CarryOverTasksInput,
} from '../../shared/validators/index';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (workspaceId: string, filters?: { date?: string; status?: string }) =>
    [...taskKeys.lists(), workspaceId, filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (workspaceId: string, taskId: string) =>
    [...taskKeys.details(), workspaceId, taskId] as const,
  pending: (workspaceId: string) => [...taskKeys.all, 'pending', workspaceId] as const,
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
    onError: () => {
      // Revert on error by refetching
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });

  const carryOverMutation = useMutation({
    mutationFn: (input: CarryOverTasksInput) => taskApi.carryOver(workspaceId, input),
    onSuccess: (tasks) => {
      tasks.forEach((task) => updateTask(task.id, task));
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
    carryOver: carryOverMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isReordering: reorderMutation.isPending,
    isCarryingOver: carryOverMutation.isPending,
  };
}

export function useTask(workspaceId: string, taskId: string) {
  return useQuery({
    queryKey: taskKeys.detail(workspaceId, taskId),
    queryFn: () => taskApi.get(workspaceId, taskId),
    enabled: Boolean(workspaceId) && Boolean(taskId),
  });
}

export function usePendingTasks(workspaceId: string) {
  return useQuery({
    queryKey: taskKeys.pending(workspaceId),
    queryFn: () => taskApi.getPending(workspaceId),
    enabled: Boolean(workspaceId),
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
