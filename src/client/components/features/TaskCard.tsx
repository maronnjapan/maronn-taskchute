import type { Task } from '../../../shared/types/index';
import { formatMinutes } from '../../../shared/utils/index';
import { TaskStatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onStatusChange?: (taskId: string, status: Task['status']) => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  isDragging = false,
  dragHandleProps,
}: TaskCardProps) {
  const handleStart = () => {
    onStatusChange?.(task.id, 'in_progress');
  };

  const handleComplete = () => {
    onStatusChange?.(task.id, 'completed');
  };

  return (
    <div
      className={`
        bg-white rounded-lg shadow-sm border border-gray-200 p-4
        ${isDragging ? 'opacity-50 shadow-lg' : ''}
        transition-shadow duration-200 hover:shadow-md
      `}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-medium text-gray-900 truncate">{task.title}</h3>
            <TaskStatusBadge status={task.status} />
          </div>

          {/* Description */}
          {task.description && (
            <p className="text-sm text-gray-500 mb-2 line-clamp-2">{task.description}</p>
          )}

          {/* Time info */}
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
            {task.estimatedMinutes !== undefined && (
              <span>見積: {formatMinutes(task.estimatedMinutes)}</span>
            )}
            {task.actualMinutes !== undefined && (
              <span>実績: {formatMinutes(task.actualMinutes)}</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {task.status === 'pending' && (
              <Button size="sm" onClick={handleStart}>
                開始
              </Button>
            )}
            {task.status === 'in_progress' && (
              <Button size="sm" variant="secondary" onClick={handleComplete}>
                完了
              </Button>
            )}
            {onEdit && (
              <Button size="sm" variant="ghost" onClick={() => onEdit(task)}>
                編集
              </Button>
            )}
            {onDelete && task.status !== 'in_progress' && (
              <Button size="sm" variant="ghost" onClick={() => onDelete(task.id)}>
                削除
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
