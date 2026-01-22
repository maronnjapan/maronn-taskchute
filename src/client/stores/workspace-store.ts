import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace } from '../../shared/types/index';

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspaceId: (id: string | null) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  getCurrentWorkspace: () => Workspace | null;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      currentWorkspaceId: null,
      setWorkspaces: (workspaces) => set({ workspaces }),
      setCurrentWorkspaceId: (currentWorkspaceId) => set({ currentWorkspaceId }),
      addWorkspace: (workspace) =>
        set((state) => ({ workspaces: [...state.workspaces, workspace] })),
      updateWorkspace: (id, updates) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        })),
      removeWorkspace: (id) =>
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
          currentWorkspaceId:
            state.currentWorkspaceId === id ? null : state.currentWorkspaceId,
        })),
      getCurrentWorkspace: () => {
        const state = get();
        return state.workspaces.find((w) => w.id === state.currentWorkspaceId) ?? null;
      },
    }),
    {
      name: 'workspace-storage',
      partialize: (state) => ({ currentWorkspaceId: state.currentWorkspaceId }),
    }
  )
);
