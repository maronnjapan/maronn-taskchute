import { Link } from 'react-router-dom';

export function HomePage() {
    return (
        <div className="container mx-auto p-4 max-w-4xl">
            <nav className="mb-6 pb-4 border-b">
                <div className="flex gap-4">
                    <Link to="/" className="text-blue-600 font-semibold">
                        ホーム
                    </Link>
                    <Link to="/tasks" className="text-gray-600 hover:text-blue-600">
                        タスク一覧
                    </Link>
                </div>
            </nav>
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">TaskChute Web</h1>
                <p className="text-gray-600">タスク管理アプリケーション（Hono RPC使用）</p>
            </div>
            <div>
                <p className="text-lg">
                    ようこそ、TaskChute Webへ！ナビゲーションバーからタスクリストページに移動して、タスクの管理を始めましょう。
                </p>
            </div>
        </div>
    );
}