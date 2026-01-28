import { useState } from 'react';
import type { Task, TimeEntry } from '../../../shared/types/index';
import { formatDateTime, formatMinutes, unixToDate, dateToUnix } from '../../../shared/utils/index';
import { useTimeEntries } from '../../hooks/use-tasks';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

interface TimeEntryListModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  workspaceId: string;
  date?: string;
}

interface EditingState {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: string;
}

function formatDateTimeLocal(timestamp: number): string {
  const date = unixToDate(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeLocal(value: string): number {
  const date = new Date(value);
  return dateToUnix(date);
}

export function TimeEntryListModal({
  isOpen,
  onClose,
  task,
  workspaceId,
  date,
}: TimeEntryListModalProps) {
  // For repeating tasks, filter time entries by the selected date
  const dateFilter = task.repeatPattern && date ? { date } : undefined;
  const { timeEntries, isLoading, update, isUpdating } = useTimeEntries(workspaceId, task.id, dateFilter);
  const [editingEntry, setEditingEntry] = useState<EditingState | null>(null);

  const handleEdit = (entry: TimeEntry) => {
    setEditingEntry({
      id: entry.id,
      startedAt: formatDateTimeLocal(entry.startedAt),
      endedAt: entry.endedAt ? formatDateTimeLocal(entry.endedAt) : '',
      durationMinutes: entry.durationMinutes?.toString() ?? '',
    });
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
  };

  const handleSaveEdit = () => {
    if (!editingEntry) return;

    const startedAt = parseDateTimeLocal(editingEntry.startedAt);
    const endedAt = editingEntry.endedAt ? parseDateTimeLocal(editingEntry.endedAt) : null;

    let durationMinutes: number | null = null;
    if (editingEntry.durationMinutes) {
      durationMinutes = parseInt(editingEntry.durationMinutes, 10);
    } else if (endedAt && startedAt) {
      durationMinutes = Math.round((endedAt - startedAt) / 60);
    }

    update(
      {
        timeEntryId: editingEntry.id,
        input: {
          startedAt,
          endedAt,
          durationMinutes,
        },
      },
      {
        onSuccess: () => {
          setEditingEntry(null);
        },
      }
    );
  };

  const handleStartedAtChange = (value: string) => {
    if (!editingEntry) return;
    const newState = { ...editingEntry, startedAt: value };

    // Auto-calculate duration if endedAt exists
    if (newState.endedAt) {
      const startedAt = parseDateTimeLocal(value);
      const endedAt = parseDateTimeLocal(newState.endedAt);
      newState.durationMinutes = Math.max(0, Math.round((endedAt - startedAt) / 60)).toString();
    }

    setEditingEntry(newState);
  };

  const handleEndedAtChange = (value: string) => {
    if (!editingEntry) return;
    const newState = { ...editingEntry, endedAt: value };

    // Auto-calculate duration
    if (value && newState.startedAt) {
      const startedAt = parseDateTimeLocal(newState.startedAt);
      const endedAt = parseDateTimeLocal(value);
      newState.durationMinutes = Math.max(0, Math.round((endedAt - startedAt) / 60)).toString();
    }

    setEditingEntry(newState);
  };

  // Sort entries by startedAt descending (newest first)
  const sortedEntries = [...timeEntries].sort((a, b) => b.startedAt - a.startedAt);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`時間記録 - ${task.title}`}>
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : sortedEntries.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            時間記録がありません
          </p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {sortedEntries.map((entry) => (
              <div
                key={entry.id}
                className="border border-gray-200 rounded-lg p-3 bg-white"
              >
                {editingEntry?.id === entry.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          開始時刻
                        </label>
                        <input
                          type="datetime-local"
                          value={editingEntry.startedAt}
                          onChange={(e) => handleStartedAtChange(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          終了時刻
                        </label>
                        <input
                          type="datetime-local"
                          value={editingEntry.endedAt}
                          onChange={(e) => handleEndedAtChange(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          disabled={!entry.endedAt}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        記録時間（分）
                      </label>
                      <input
                        type="number"
                        value={editingEntry.durationMinutes}
                        onChange={(e) =>
                          setEditingEntry({ ...editingEntry, durationMinutes: e.target.value })
                        }
                        className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                        min="0"
                        max="1440"
                        disabled={!entry.endedAt}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={isUpdating}
                      >
                        {isUpdating ? '保存中...' : '保存'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        disabled={isUpdating}
                      >
                        キャンセル
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">開始:</span>
                        <span className="font-medium">{formatDateTime(entry.startedAt)}</span>
                      </div>
                      {entry.endedAt ? (
                        <>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">終了:</span>
                            <span className="font-medium">{formatDateTime(entry.endedAt)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">記録:</span>
                            <span className="font-medium text-blue-600">
                              {entry.durationMinutes !== undefined
                                ? formatMinutes(entry.durationMinutes)
                                : '-'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-blue-600 font-medium animate-pulse">
                          記録中...
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        作成: {formatDateTime(entry.createdAt)}
                        {entry.updatedAt !== entry.createdAt && (
                          <> / 更新: {formatDateTime(entry.updatedAt)}</>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(entry)}
                      disabled={!entry.endedAt}
                    >
                      編集
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">合計記録時間:</span>
            <span className="font-bold text-lg">
              {task.actualMinutes !== undefined && task.actualMinutes > 0
                ? formatMinutes(task.actualMinutes)
                : '0分'}
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
