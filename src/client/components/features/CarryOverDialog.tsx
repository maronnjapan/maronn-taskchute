import { useState, useMemo } from 'react';
import type { Task } from '../../../shared/types/index';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { getTodayString } from '../../../shared/utils/index';

interface CarryOverDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pendingTasks: Task[];
  onCarryOver: (taskIds: string[], targetDate: string) => void;
  isLoading?: boolean;
}

export function CarryOverDialog({
  isOpen,
  onClose,
  pendingTasks,
  onCarryOver,
  isLoading = false,
}: CarryOverDialogProps) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [targetDate, setTargetDate] = useState(getTodayString());

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    for (const task of pendingTasks) {
      const tasks = grouped.get(task.scheduledDate) ?? [];
      tasks.push(task);
      grouped.set(task.scheduledDate, tasks);
    }
    return grouped;
  }, [pendingTasks]);

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTaskIds(new Set(pendingTasks.map((t) => t.id)));
  };

  const deselectAll = () => {
    setSelectedTaskIds(new Set());
  };

  const handleSubmit = () => {
    if (selectedTaskIds.size === 0) return;
    onCarryOver(Array.from(selectedTaskIds), targetDate);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="未完了タスクの繰り越し">
      <div className="space-y-4">
        {pendingTasks.length === 0 ? (
          <p className="text-sm text-gray-500">繰り越し可能なタスクはありません。</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {selectedTaskIds.size} / {pendingTasks.length} 件選択中
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  すべて選択
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll}>
                  選択解除
                </Button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
              {Array.from(tasksByDate.entries()).map(([date, tasks]) => (
                <div key={date} className="p-2">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    {new Date(date).toLocaleDateString('ja-JP', {
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <div className="space-y-1">
                    {tasks.map((task) => (
                      <label
                        key={task.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.has(task.id)}
                          onChange={() => toggleTask(task.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900 truncate">{task.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">繰り越し先:</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                min={getTodayString()}
                className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedTaskIds.size === 0}
            isLoading={isLoading}
          >
            繰り越す
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
