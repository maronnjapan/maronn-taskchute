import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '../services/api-client';
import { useWorkspaceStore } from '../stores/workspace-store';
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from '../../shared/validators/index';

export const workspaceKeys = {
  all: ['workspaces'] as const,
  lists: () => [...workspaceKeys.all, 'list'] as const,
  list: () => [...workspaceKeys.lists()] as const,
  details: () => [...workspaceKeys.all, 'detail'] as const,
  detail: (id: string) => [...workspaceKeys.details(), id] as const,
  byShareToken: (token: string) => [...workspaceKeys.all, 'share', token] as const,
};

export function useWorkspaces() {
  const queryClient = useQueryClient();
  const { setWorkspaces, addWorkspace, updateWorkspace, removeWorkspace } = useWorkspaceStore();

  const listQuery = useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: async () => {
      const workspaces = await workspaceApi.list();
      setWorkspaces(workspaces);
      return workspaces;
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateWorkspaceInput) => workspaceApi.create(input),
    onSuccess: (workspace) => {
      addWorkspace(workspace);
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWorkspaceInput }) =>
      workspaceApi.update(id, input),
    onSuccess: (workspace) => {
      updateWorkspace(workspace.id, workspace);
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspace.id) });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workspaceApi.delete(id),
    onSuccess: (_, id) => {
      removeWorkspace(id);
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
    },
  });

  const regenerateTokenMutation = useMutation({
    mutationFn: (id: string) => workspaceApi.regenerateToken(id),
    onSuccess: (workspace) => {
      updateWorkspace(workspace.id, workspace);
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspace.id) });
    },
  });

  return {
    workspaces: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    regenerateToken: regenerateTokenMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useWorkspace(id: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(id),
    queryFn: () => workspaceApi.get(id),
    enabled: Boolean(id),
  });
}

export function useWorkspaceByShareToken(shareToken: string) {
  return useQuery({
    queryKey: workspaceKeys.byShareToken(shareToken),
    queryFn: () => workspaceApi.getByShareToken(shareToken),
    enabled: Boolean(shareToken),
  });
}
