import { create } from 'zustand';
import type { Task } from '../../shared/types/index';
import { getTodayString } from '../../shared/utils/index';

interface TaskState {
  tasks: Task[];
  selectedDate: string;
  selectedTaskId: string | null;
  setTasks: (tasks: Task[]) => void;
  setSelectedDate: (date: string) => void;
  setSelectedTaskId: (id: string | null) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  reorderTasks: (taskIds: string[]) => void;
  getTasksForSelectedDate: () => Task[];
  getSelectedTask: () => Task | null;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  selectedDate: getTodayString(),
  selectedTaskId: null,
  setTasks: (tasks) => set({ tasks }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
    })),
  reorderTasks: (taskIds) =>
    set((state) => {
      const taskMap = new Map(state.tasks.map((t) => [t.id, t]));
      const reorderedTasks = taskIds
        .map((id, index) => {
          const task = taskMap.get(id);
          return task ? { ...task, sortOrder: index } : null;
        })
        .filter((t): t is Task => t !== null);

      const otherTasks = state.tasks.filter((t) => !taskIds.includes(t.id));
      return { tasks: [...otherTasks, ...reorderedTasks] };
    }),
  getTasksForSelectedDate: () => {
    const state = get();
    return state.tasks
      .filter((t) => t.scheduledDate === state.selectedDate)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
  getSelectedTask: () => {
    const state = get();
    return state.tasks.find((t) => t.id === state.selectedTaskId) ?? null;
  },
}));
