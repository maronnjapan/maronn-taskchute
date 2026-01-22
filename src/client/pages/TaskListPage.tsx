import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Task } from '../../shared/types/api';
import { client } from '../services/api-client';

export function TaskListPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      // Hono RPCクライアントを使用
      const response = await client.tasks.$get();

      if (!response.ok) {
        throw new Error('タスクの取得に失敗しました');
      }

      const data = await response.json();
      setTasks(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: Task['status']) => {
    const labels = {
      pending: '未着手',
      in_progress: '進行中',
      completed: '完了',
      carried_over: '繰越',
    };
    return labels[status];
  };

  const getStatusColor = (status: Task['status']) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      carried_over: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status];
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <nav className="mb-6 pb-4 border-b">
        <div className="flex gap-4">
          <Link to="/" className="text-gray-600 hover:text-blue-600">
            ホーム
          </Link>
          <Link to="/tasks" className="text-blue-600 font-semibold">
            タスク一覧
          </Link>
        </div>
      </nav>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">タスク一覧</h1>
        <p className="text-gray-600">タスク管理アプリケーション（Hono RPC使用）</p>
      </div>

      <div className="mb-4">
        <button
          onClick={fetchTasks}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '読み込み中...' : 'タスクを取得'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {tasks.length > 0 ? (
        <div className="space-y-4">
          {tasks.map((task) => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold">{task.title}</h3>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(task.status)}`}
                >
                  {getStatusLabel(task.status)}
                </span>
              </div>
              {task.description && (
                <p className="text-gray-600 text-sm mb-3">{task.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>📅 {task.scheduledDate}</span>
                {task.estimatedMinutes && (
                  <span>⏱️ 見積: {task.estimatedMinutes}分</span>
                )}
                {task.actualMinutes && (
                  <span>✅ 実績: {task.actualMinutes}分</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        !loading && (
          <div className="text-center py-8 text-gray-500">
            <p>「タスクを取得」ボタンをクリックしてタスクを表示してください</p>
          </div>
        )
      )}
    </div>
  );
}
