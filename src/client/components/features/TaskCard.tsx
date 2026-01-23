import type { Task, TimeEntry } from '../../../shared/types/index';
import { formatMinutes } from '../../../shared/utils/index';
import { TaskStatusBadge, RepeatPatternBadge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface TaskCardProps {
  task: Task;
  activeTimeEntry?: TimeEntry | null;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onStartTimeEntry?: (taskId: string) => void;
  onStopTimeEntry?: (taskId: string, timeEntryId: string) => void;
  onViewTimeEntries?: (task: Task) => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function TaskCard({
  task,
  activeTimeEntry,
  onEdit,
  onDelete,
  onStartTimeEntry,
  onStopTimeEntry,
  onViewTimeEntries,
  isDragging = false,
  dragHandleProps,
}: TaskCardProps) {
  const handleStart = () => {
    onStartTimeEntry?.(task.id);
  };

  const handleStop = () => {
    if (activeTimeEntry) {
      onStopTimeEntry?.(task.id, activeTimeEntry.id);
    }
  };

  const isRecording = Boolean(activeTimeEntry);

  return (
    <div
      className={`
        bg-white rounded-lg shadow-sm border border-gray-200 p-4
        ${isDragging ? 'opacity-50 shadow-lg' : ''}
        ${isRecording ? 'border-blue-400 ring-2 ring-blue-100' : ''}
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
            <div className="flex items-center gap-1">
              {task.repeatPattern && (
                <RepeatPatternBadge pattern={task.repeatPattern} />
              )}
              <TaskStatusBadge status={task.status} />
            </div>
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
            {task.actualMinutes !== undefined && task.actualMinutes > 0 && (
              <span>実績: {formatMinutes(task.actualMinutes)}</span>
            )}
            {isRecording && (
              <span className="text-blue-600 font-medium animate-pulse">記録中...</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isRecording ? (
              <Button size="sm" variant="secondary" onClick={handleStop}>
                停止
              </Button>
            ) : (
              <Button size="sm" onClick={handleStart}>
                記録開始
              </Button>
            )}
            {onViewTimeEntries && (
              <Button size="sm" variant="ghost" onClick={() => onViewTimeEntries(task)}>
                時間記録
              </Button>
            )}
            {onEdit && (
              <Button size="sm" variant="ghost" onClick={() => onEdit(task)}>
                編集
              </Button>
            )}
            {onDelete && !isRecording && (
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
