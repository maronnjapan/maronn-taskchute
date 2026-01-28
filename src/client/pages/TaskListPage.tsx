import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../hooks/use-auth';
import { useWorkspaces } from '../hooks/use-workspaces';
import { useTasks, useAverageDurationByTitle, useActiveTimeEntries } from '../hooks/use-tasks';
import { useWorkspaceStore } from '../stores/workspace-store';
import { useTaskStore } from '../stores/task-store';
import { useUiStore } from '../stores/ui-store';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import {
  SortableTaskList,
  TaskForm,
  DateNavigator,
  WorkspaceSelector,
  WorkspaceForm,
  TimeSummary,
  ShareLinkDisplay,
  TimeEntryListModal,
} from '../components/features';
import { timeEntryApi, taskApi } from '../services/api-client';
import type { Task, TimeEntry } from '../../shared/types/index';
import type { CreateTaskInput, UpdateTaskInput } from '../../shared/validators/index';

export function TaskListPage() {
  const { isAuthenticated, isLoading: isAuthLoading, login } = useAuth();
  const { workspaces, create: createWorkspace, isCreating: isCreatingWorkspace } = useWorkspaces();
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore();
  const { selectedDate, updateTask: updateTaskInStore } = useTaskStore();
  const {
    isTaskFormOpen,
    isWorkspaceFormOpen,
    editingTaskId,
    setWorkspaceFormOpen,
    openTaskForm,
    closeTaskForm,
  } = useUiStore();

  // Track active time entries per task (manual updates)
  const [manualActiveTimeEntries, setManualActiveTimeEntries] = useState<Map<string, TimeEntry>>(new Map());

  // Track task ID for time entry modal (use ID so we can always get latest task from store)
  const [viewingTimeEntriesTaskId, setViewingTimeEntriesTaskId] = useState<string | null>(null);

  // Auto-select first workspace if none selected
  const activeWorkspaceId = useMemo(() => {
    if (currentWorkspaceId && workspaces.some((w) => w.id === currentWorkspaceId)) {
      return currentWorkspaceId;
    }
    if (workspaces.length > 0) {
      setCurrentWorkspaceId(workspaces[0].id);
      return workspaces[0].id;
    }
    return null;
  }, [currentWorkspaceId, workspaces, setCurrentWorkspaceId]);

  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId),
    [workspaces, activeWorkspaceId]
  );

  const {
    tasks,
    isLoading: isTasksLoading,
    create: createTask,
    update: updateTask,
    delete: deleteTask,
    reorder,
    isCreating,
    isUpdating,
  } = useTasks(activeWorkspaceId ?? '', { date: selectedDate });

  // Fetch active time entries from server
  const { data: serverActiveTimeEntries } = useActiveTimeEntries(activeWorkspaceId ?? '', tasks);

  // Get the task being edited
  const editingTask = useMemo(
    () => (editingTaskId ? tasks.find((t) => t.id === editingTaskId) : undefined),
    [editingTaskId, tasks]
  );

  // Get the task for time entry modal (always latest from store)
  const viewingTimeEntriesTask = useMemo(
    () => (viewingTimeEntriesTaskId ? tasks.find((t) => t.id === viewingTimeEntriesTaskId) : undefined),
    [viewingTimeEntriesTaskId, tasks]
  );

  // Fetch average duration for repeating tasks to use as default estimated time
  const { data: averageDuration } = useAverageDurationByTitle(
    activeWorkspaceId ?? '',
    editingTask?.repeatPattern ? editingTask.title : undefined
  );

  // Calculate default estimated minutes for task form
  const defaultEstimatedMinutes = useMemo(() => {
    // For editing repeating tasks, use average duration as default if available
    if (editingTask?.repeatPattern && averageDuration) {
      return Math.round(averageDuration);
    }
    return undefined;
  }, [editingTask, averageDuration]);

  // Merge server and manual active time entries
  const activeTimeEntries = useMemo(() => {
    const merged = new Map<string, TimeEntry>();
    // Start with server data
    if (serverActiveTimeEntries) {
      serverActiveTimeEntries.forEach((entry, taskId) => {
        merged.set(taskId, entry);
      });
    }
    // Override with manual updates
    manualActiveTimeEntries.forEach((entry, taskId) => {
      merged.set(taskId, entry);
    });
    return merged;
  }, [serverActiveTimeEntries, manualActiveTimeEntries]);

  // Handlers
  const handleCreateWorkspace = useCallback(
    (data: { name: string }) => {
      createWorkspace(data, {
        onSuccess: (workspace) => {
          setCurrentWorkspaceId(workspace.id);
          setWorkspaceFormOpen(false);
        },
      });
    },
    [createWorkspace, setCurrentWorkspaceId, setWorkspaceFormOpen]
  );

  const handleCreateTask = useCallback(
    (data: CreateTaskInput | UpdateTaskInput) => {
      if (editingTaskId) {
        updateTask(
          { taskId: editingTaskId, input: data as UpdateTaskInput },
          { onSuccess: () => closeTaskForm() }
        );
      } else {
        createTask(data as CreateTaskInput, { onSuccess: () => closeTaskForm() });
      }
    },
    [editingTaskId, createTask, updateTask, closeTaskForm]
  );

  const handleEditTask = useCallback(
    (task: Task) => {
      openTaskForm(task.id);
    },
    [openTaskForm]
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      if (confirm('このタスクを削除しますか？')) {
        deleteTask(taskId);
      }
    },
    [deleteTask]
  );

  const handleStartTimeEntry = useCallback(
    async (taskId: string) => {
      if (!activeWorkspaceId) return;
      try {
        const timeEntry = await timeEntryApi.start(activeWorkspaceId, taskId);
        setManualActiveTimeEntries((prev) => {
          const next = new Map(prev);
          next.set(taskId, timeEntry);
          return next;
        });
      } catch (error) {
        console.error('Failed to start time entry:', error);
      }
    },
    [activeWorkspaceId]
  );

  const handleStopTimeEntry = useCallback(
    async (taskId: string, timeEntryId: string) => {
      if (!activeWorkspaceId) return;
      try {
        await timeEntryApi.stop(activeWorkspaceId, taskId, timeEntryId);
        setManualActiveTimeEntries((prev) => {
          const next = new Map(prev);
          next.delete(taskId);
          return next;
        });
        // タスクの実績時間を更新するため、最新のタスク情報を取得してストアを更新
        const updatedTask = await taskApi.get(activeWorkspaceId, taskId);
        updateTaskInStore(updatedTask.id, updatedTask);
      } catch (error) {
        console.error('Failed to stop time entry:', error);
      }
    },
    [activeWorkspaceId, updateTaskInStore]
  );

  const handleViewTimeEntries = useCallback((task: Task) => {
    setViewingTimeEntriesTaskId(task.id);
  }, []);

  const handleCloseTimeEntries = useCallback(() => {
    setViewingTimeEntriesTaskId(null);
  }, []);

  // Loading state
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">TaskChute へようこそ</h1>
        <p className="text-gray-600 mb-8">
          タスクシュート方式の時間記録・管理ができるWebアプリケーションです。
          <br />
          ログインして始めましょう。
        </p>
        <Button size="lg" onClick={login}>
          ログインして始める
        </Button>
      </div>
    );
  }

  // No workspace
  if (workspaces.length === 0 && !isWorkspaceFormOpen) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">ワークスペースを作成</h1>
        <p className="text-gray-600 mb-8">
          最初のワークスペースを作成して、タスク管理を始めましょう。
        </p>
        <Button onClick={() => setWorkspaceFormOpen(true)}>
          ワークスペースを作成
        </Button>

        <Dialog
          isOpen={isWorkspaceFormOpen}
          onClose={() => setWorkspaceFormOpen(false)}
          title="新規ワークスペース"
        >
          <WorkspaceForm
            onSubmit={handleCreateWorkspace}
            onCancel={() => setWorkspaceFormOpen(false)}
            isSubmitting={isCreatingWorkspace}
          />
        </Dialog>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header with workspace selector and date navigator */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="w-64">
            <WorkspaceSelector
              workspaces={workspaces}
              onCreateNew={() => setWorkspaceFormOpen(true)}
            />
          </div>
          <DateNavigator />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button onClick={() => openTaskForm()}>新規タスク</Button>
          </div>
        </div>
      </div>

      {/* Time summary */}
      <div className="mb-6">
        <TimeSummary tasks={tasks} />
      </div>

      {/* Task list */}
      {isTasksLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <SortableTaskList
          tasks={tasks}
          activeTimeEntries={activeTimeEntries}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          onStartTimeEntry={handleStartTimeEntry}
          onStopTimeEntry={handleStopTimeEntry}
          onViewTimeEntries={handleViewTimeEntries}
          onReorder={(taskIds) => reorder({ taskIds })}
          emptyMessage="この日にタスクはありません。新規タスクを追加してください。"
        />
      )}

      {/* Share link */}
      {currentWorkspace && (
        <div className="mt-8">
          <ShareLinkDisplay workspace={currentWorkspace} />
        </div>
      )}

      {/* Task form dialog */}
      <Dialog
        isOpen={isTaskFormOpen}
        onClose={closeTaskForm}
        title={editingTask ? 'タスクを編集' : '新規タスク'}
      >
        <TaskForm
          task={editingTask}
          onSubmit={handleCreateTask}
          onCancel={closeTaskForm}
          isSubmitting={isCreating || isUpdating}
          defaultDate={selectedDate}
          defaultEstimatedMinutes={defaultEstimatedMinutes}
        />
      </Dialog>

      {/* Workspace form dialog */}
      <Dialog
        isOpen={isWorkspaceFormOpen}
        onClose={() => setWorkspaceFormOpen(false)}
        title="新規ワークスペース"
      >
        <WorkspaceForm
          onSubmit={handleCreateWorkspace}
          onCancel={() => setWorkspaceFormOpen(false)}
          isSubmitting={isCreatingWorkspace}
        />
      </Dialog>

      {/* Time entry list modal */}
      {viewingTimeEntriesTask && activeWorkspaceId && (
        <TimeEntryListModal
          isOpen={Boolean(viewingTimeEntriesTask)}
          onClose={handleCloseTimeEntries}
          task={viewingTimeEntriesTask}
          workspaceId={activeWorkspaceId}
          date={selectedDate}
        />
      )}
    </div>
  );
}
