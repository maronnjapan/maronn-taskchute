import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspaceByShareToken, useTasksByShareToken, useAverageDurationByTitle, useActiveTimeEntries } from '../hooks';
import { useTaskStore } from '../stores/task-store';
import { taskApi, timeEntryApi } from '../services/api-client';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { SortableTaskList, TaskForm, DateNavigator, TimeSummary } from '../components/features';
import type { Task, TimeEntry } from '../../shared/types/index';
import type { CreateTaskInput, UpdateTaskInput } from '../../shared/validators/index';

export function SharedWorkspacePage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const { selectedDate } = useTaskStore();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualActiveTimeEntries, setManualActiveTimeEntries] = useState<Map<string, TimeEntry>>(new Map());

  const {
    data: workspace,
    isLoading: isWorkspaceLoading,
    error: workspaceError,
  } = useWorkspaceByShareToken(shareToken ?? '');

  const {
    data: tasks = [],
    isLoading: isTasksLoading,
    refetch: refetchTasks,
  } = useTasksByShareToken(shareToken ?? '', { date: selectedDate });

  // Fetch active time entries from server
  const { data: serverActiveTimeEntries } = useActiveTimeEntries(workspace?.id ?? '', tasks);

  const editingTask = useMemo(
    () => (editingTaskId ? tasks.find((t) => t.id === editingTaskId) : undefined),
    [editingTaskId, tasks]
  );

  // Fetch average duration for repeating tasks to use as default estimated time
  const { data: averageDuration } = useAverageDurationByTitle(
    workspace?.id ?? '',
    editingTask?.repeatPattern ? editingTask.title : undefined
  );

  // Calculate default estimated minutes for task form
  const defaultEstimatedMinutes = useMemo(() => {
    if (editingTask?.repeatPattern && !editingTask.estimatedMinutes && averageDuration) {
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

  const openTaskForm = useCallback((taskId?: string) => {
    setEditingTaskId(taskId ?? null);
    setIsTaskFormOpen(true);
  }, []);

  const closeTaskForm = useCallback(() => {
    setIsTaskFormOpen(false);
    setEditingTaskId(null);
  }, []);

  const handleCreateTask = useCallback(
    async (data: CreateTaskInput | UpdateTaskInput) => {
      if (!shareToken) return;

      setIsSubmitting(true);
      try {
        if (editingTaskId) {
          await taskApi.updateByShareToken(shareToken, editingTaskId, data as UpdateTaskInput);
        } else {
          await taskApi.createByShareToken(shareToken, data as CreateTaskInput);
        }
        closeTaskForm();
        void refetchTasks();
      } catch (error) {
        console.error('Failed to save task:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [shareToken, editingTaskId, closeTaskForm, refetchTasks]
  );

  const handleEditTask = useCallback((task: Task) => {
    openTaskForm(task.id);
  }, [openTaskForm]);

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      if (!shareToken) return;
      if (!confirm('このタスクを削除しますか？')) return;

      try {
        await taskApi.deleteByShareToken(shareToken, taskId);
        void refetchTasks();
      } catch (error) {
        console.error('Failed to delete task:', error);
      }
    },
    [shareToken, refetchTasks]
  );

  const handleStartTimeEntry = useCallback(
    async (taskId: string) => {
      if (!shareToken) return;

      try {
        const timeEntry = await timeEntryApi.startByShareToken(shareToken, taskId);
        setManualActiveTimeEntries((prev) => new Map(prev).set(taskId, timeEntry));
        void refetchTasks();
      } catch (error) {
        console.error('Failed to start time entry:', error);
      }
    },
    [shareToken, refetchTasks]
  );

  const handleStopTimeEntry = useCallback(
    async (taskId: string, timeEntryId: string) => {
      if (!shareToken) return;

      try {
        await timeEntryApi.stopByShareToken(shareToken, taskId, timeEntryId);
        setManualActiveTimeEntries((prev) => {
          const next = new Map(prev);
          next.delete(taskId);
          return next;
        });
        void refetchTasks();
      } catch (error) {
        console.error('Failed to stop time entry:', error);
      }
    },
    [shareToken, refetchTasks]
  );

  // Loading state
  if (isWorkspaceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Error state
  if (workspaceError || !workspace) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          ワークスペースが見つかりません
        </h1>
        <p className="text-gray-600">
          共有リンクが無効か、ワークスペースが削除された可能性があります。
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{workspace.name}</h1>
            <p className="text-sm text-gray-500">共有ワークスペース</p>
          </div>
          <DateNavigator />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button onClick={() => openTaskForm()}>新規タスク</Button>
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
          emptyMessage="この日にタスクはありません。新規タスクを追加してください。"
        />
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
          isSubmitting={isSubmitting}
          defaultDate={selectedDate}
          defaultEstimatedMinutes={defaultEstimatedMinutes}
        />
      </Dialog>
    </div>
  );
}
