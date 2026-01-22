import { Hono } from 'hono';
import type { Task } from '../shared/types/api';

type Bindings = {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  ENVIRONMENT?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// APIルート
const api = new Hono<{ Bindings: Bindings }>()
  .get('/', (c) => {
    return c.json({ message: 'Hello from Hono API!' });
  })
  .get('/tasks', (c) => {
    const tasks: Task[] = [
      {
        id: '1',
        title: 'プロジェクト設計書を作成',
        description: 'TaskChute Webアプリの設計書を作成する',
        scheduledDate: '2026-01-22',
        status: 'in_progress',
        estimatedMinutes: 120,
        actualMinutes: 60,
      },
      {
        id: '2',
        title: 'データベーススキーマ設計',
        description: 'D1データベースのテーブル設計を行う',
        scheduledDate: '2026-01-22',
        status: 'pending',
        estimatedMinutes: 90,
        actualMinutes: null,
      },
      {
        id: '3',
        title: 'API実装',
        description: 'Honoでタスク管理APIを実装する',
        scheduledDate: '2026-01-22',
        status: 'completed',
        estimatedMinutes: 180,
        actualMinutes: 200,
      },
    ];

    return c.json({ data: tasks });
  })
  // 動的ルーティング: /api/tasks/:id
  .get('/tasks/:id', (c) => {
    const id = c.req.param('id');
    
    const tasks: Task[] = [
      {
        id: '1',
        title: 'プロジェクト設計書を作成',
        description: 'TaskChute Webアプリの設計書を作成する',
        scheduledDate: '2026-01-22',
        status: 'in_progress',
        estimatedMinutes: 120,
        actualMinutes: 60,
      },
      {
        id: '2',
        title: 'データベーススキーマ設計',
        description: 'D1データベースのテーブル設計を行う',
        scheduledDate: '2026-01-22',
        status: 'pending',
        estimatedMinutes: 90,
        actualMinutes: null,
      },
      {
        id: '3',
        title: 'API実装',
        description: 'Honoでタスク管理APIを実装する',
        scheduledDate: '2026-01-22',
        status: 'completed',
        estimatedMinutes: 180,
        actualMinutes: 200,
      },
    ];

    const task = tasks.find(t => t.id === id);
    
    if (!task) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'タスクが見つかりません' } }, 404);
    }
    
    return c.json({ data: task });
  });

// APIをマウント
app.route('/api', api);

// 静的アセット配信とSPAフォールバック
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  let pathname = url.pathname;

  // ルートパスまたは拡張子がないパス（SPAルート）は index.html を返す
  if (pathname === '/' || (!pathname.includes('.') && !pathname.startsWith('/api'))) {
    const indexRequest = new Request(new URL('/index.html', url.origin));
    const indexResponse = await c.env.ASSETS.fetch(indexRequest);
    
    // 新しいHeadersオブジェクトを作成（locationを除外）
    const newHeaders = new Headers();
    for (const [key, value] of indexResponse.headers.entries()) {
      if (key.toLowerCase() !== 'location') {
        newHeaders.set(key, value);
      }
    }
    newHeaders.set('Content-Type', 'text/html; charset=utf-8');
    
    return new Response(indexResponse.body, {
      status: 200,
      headers: newHeaders,
    });
  }

  // 静的アセット（JS, CSS, 画像など）を配信
  const assetRequest = new Request(new URL(pathname, url.origin));

  try {
    const response = await c.env.ASSETS.fetch(assetRequest);
    
    // 404の場合は index.html を返す（SPA フォールバック）
    if (response.status === 404) {
      const indexRequest = new Request(new URL('/index.html', url.origin));
      const indexResponse = await c.env.ASSETS.fetch(indexRequest);
      
      const newHeaders = new Headers();
      for (const [key, value] of indexResponse.headers.entries()) {
        if (key.toLowerCase() !== 'location') {
          newHeaders.set(key, value);
        }
      }
      newHeaders.set('Content-Type', 'text/html; charset=utf-8');
      
      return new Response(indexResponse.body, {
        status: 200,
        headers: newHeaders,
      });
    }
    
    return response;
  } catch (error) {
    console.error('Asset fetch error:', error);
    // エラー時も index.html を返す
    const indexRequest = new Request(new URL('/index.html', url.origin));
    const indexResponse = await c.env.ASSETS.fetch(indexRequest);
    
    const newHeaders = new Headers();
    for (const [key, value] of indexResponse.headers.entries()) {
      if (key.toLowerCase() !== 'location') {
        newHeaders.set(key, value);
      }
    }
    newHeaders.set('Content-Type', 'text/html; charset=utf-8');
    
    return new Response(indexResponse.body, {
      status: 200,
      headers: newHeaders,
    });
  }
});

// RPC用に型をエクスポート
export type AppType = typeof api;

export default app;

