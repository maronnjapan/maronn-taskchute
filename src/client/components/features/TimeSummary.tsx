import type { Task } from '../../../shared/types/index';
import { formatMinutes } from '../../../shared/utils/index';
import { useMemo } from 'react';

interface TimeSummaryProps {
  tasks: Task[];
}

export function TimeSummary({ tasks }: TimeSummaryProps) {
  const summary = useMemo(() => {
    let totalEstimated = 0;
    let totalActual = 0;
    let inProgressCount = 0;
    let pendingCount = 0;

    for (const task of tasks) {
      if (task.estimatedMinutes) {
        totalEstimated += task.estimatedMinutes;
      }
      if (task.actualMinutes) {
        totalActual += task.actualMinutes;
      }
      if (task.status === 'in_progress') {
        inProgressCount++;
      } else {
        pendingCount++;
      }
    }

    return {
      totalEstimated,
      totalActual,
      inProgressCount,
      pendingCount,
      totalCount: tasks.length,
    };
  }, [tasks]);

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">サマリー</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500">タスク数</p>
          <p className="text-lg font-semibold text-gray-900">
            {summary.totalCount}
            <span className="text-sm font-normal text-gray-500 ml-1">件</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">着手済</p>
          <p className="text-lg font-semibold text-blue-600">{summary.inProgressCount}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">見積合計</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatMinutes(summary.totalEstimated)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">実績合計</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatMinutes(summary.totalActual)}
          </p>
        </div>
      </div>
    </div>
  );
}
