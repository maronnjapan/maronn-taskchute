import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Task } from '../../shared/types/api';
import { client } from '../services/api-client';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTask = async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await client.tasks[':id'].$get({ param: { id } });

      if (!response.ok) {
        throw new Error('タスクの取得に失敗しました');
      }

      const data = await response.json();
      setTask(data.data);
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
          <Link to="/tasks" className="text-gray-600 hover:text-blue-600">
            タスク一覧
          </Link>
          <span className="text-blue-600 font-semibold">
            タスク詳細
          </span>
        </div>
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">タスク詳細</h1>
        <p className="text-gray-600">タスクID: {id}</p>
      </div>

      <div className="mb-4">
        <button
          onClick={fetchTask}
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

      {task ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-md">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold">{task.title}</h2>
            <span
              className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(task.status)}`}
            >
              {getStatusLabel(task.status)}
            </span>
          </div>
          
          {task.description && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">説明</h3>
              <p className="text-gray-700">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-1">予定日</h3>
              <p className="text-lg">📅 {task.scheduledDate}</p>
            </div>
            
            {task.estimatedMinutes && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">見積時間</h3>
                <p className="text-lg">⏱️ {task.estimatedMinutes}分</p>
              </div>
            )}
            
            {task.actualMinutes && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">実績時間</h3>
                <p className="text-lg">✅ {task.actualMinutes}分</p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t">
            <Link 
              to="/tasks" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← タスク一覧に戻る
            </Link>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="text-center py-8 text-gray-500">
            <p>「タスクを取得」ボタンをクリックしてタスク詳細を表示してください</p>
          </div>
        )
      )}
    </div>
  );
}
