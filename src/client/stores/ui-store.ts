import { create } from 'zustand';

interface UiState {
  isTaskFormOpen: boolean;
  isWorkspaceFormOpen: boolean;
  isCarryOverDialogOpen: boolean;
  editingTaskId: string | null;
  isSidebarOpen: boolean;
  setTaskFormOpen: (open: boolean) => void;
  setWorkspaceFormOpen: (open: boolean) => void;
  setCarryOverDialogOpen: (open: boolean) => void;
  setEditingTaskId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  openTaskForm: (taskId?: string) => void;
  closeTaskForm: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isTaskFormOpen: false,
  isWorkspaceFormOpen: false,
  isCarryOverDialogOpen: false,
  editingTaskId: null,
  isSidebarOpen: true,
  setTaskFormOpen: (isTaskFormOpen) => set({ isTaskFormOpen }),
  setWorkspaceFormOpen: (isWorkspaceFormOpen) => set({ isWorkspaceFormOpen }),
  setCarryOverDialogOpen: (isCarryOverDialogOpen) => set({ isCarryOverDialogOpen }),
  setEditingTaskId: (editingTaskId) => set({ editingTaskId }),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  openTaskForm: (taskId) =>
    set({ isTaskFormOpen: true, editingTaskId: taskId ?? null }),
  closeTaskForm: () => set({ isTaskFormOpen: false, editingTaskId: null }),
}));
