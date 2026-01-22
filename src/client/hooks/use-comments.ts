import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentApi } from '../services/api-client';
import type { CreateTaskCommentInput, UpdateTaskCommentInput } from '../../shared/validators/index';

export const commentKeys = {
  all: ['comments'] as const,
  lists: () => [...commentKeys.all, 'list'] as const,
  list: (taskId: string) => [...commentKeys.lists(), taskId] as const,
};

export function useComments(taskId: string) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: commentKeys.list(taskId),
    queryFn: () => commentApi.list(taskId),
    enabled: !!taskId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTaskCommentInput) => commentApi.create(taskId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ commentId, input }: { commentId: string; input: UpdateTaskCommentInput }) =>
      commentApi.update(commentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => commentApi.delete(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
  });

  return {
    comments: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
