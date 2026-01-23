import type { Task, TimeEntry } from '../../../shared/types/index';
import { TaskCard } from './TaskCard';

interface TaskListProps {
  tasks: Task[];
  activeTimeEntries?: Map<string, TimeEntry>;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onStartTimeEntry?: (taskId: string) => void;
  onStopTimeEntry?: (taskId: string, timeEntryId: string) => void;
  emptyMessage?: string;
}

export function TaskList({
  tasks,
  activeTimeEntries,
  onEditTask,
  onDeleteTask,
  onStartTimeEntry,
  onStopTimeEntry,
  emptyMessage = 'タスクがありません',
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          activeTimeEntry={activeTimeEntries?.get(task.id)}
          onEdit={onEditTask}
          onDelete={onDeleteTask}
          onStartTimeEntry={onStartTimeEntry}
          onStopTimeEntry={onStopTimeEntry}
        />
      ))}
    </div>
  );
}
