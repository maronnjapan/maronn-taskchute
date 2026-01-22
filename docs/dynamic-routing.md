# Cloudflare Workers Assets での動的ルーティング

## 結論

**Cloudflare Workers の Assets 機能自体には動的ルーティングの設定機能はありません。**

ただし、**Hono（またはその他のフレームワーク）と組み合わせることで、完全な動的ルーティングを実装できます。**

## Assets の役割

Cloudflare Workers の `assets` 設定は、純粋に**静的ファイルの配信**のための機能です：

```jsonc
{
  "assets": {
    "directory": "./dist/client",
    "binding": "ASSETS"
  }
}
```

この設定でできること：
- ✅ 静的ファイル（HTML, CSS, JS, 画像など）を配信
- ✅ ファイルの自動圧縮（gzip, brotli）
- ✅ CDNキャッシング
- ✅ ETag による条件付きリクエスト

できないこと：
- ❌ 動的ルーティングの定義
- ❌ パスパラメータの処理（`:id` など）
- ❌ 条件分岐やビジネスロジック

## 動的ルーティングの実装方法

### 1. サーバーサイド（Hono）で動的ルートを定義

`src/server/index.ts`:

```typescript
const api = new Hono()
  // 静的ルート
  .get('/tasks', (c) => {
    // タスク一覧を返す
    return c.json({ data: tasks });
  })
  // 動的ルート - パスパラメータ :id
  .get('/tasks/:id', (c) => {
    const id = c.req.param('id');  // パラメータを取得
    const task = tasks.find(t => t.id === id);
    
    if (!task) {
      return c.json({ 
        error: { code: 'NOT_FOUND', message: 'タスクが見つかりません' } 
      }, 404);
    }
    
    return c.json({ data: task });
  })
  // 複数のパラメータも可能
  .get('/workspaces/:workspaceId/tasks/:taskId', (c) => {
    const { workspaceId, taskId } = c.req.param();
    // ...
  });

app.route('/api', api);
```

### 2. クライアントサイド（React Router）で動的ルートを定義

`src/client/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tasks" element={<TaskListPage />} />
        {/* 動的ルート */}
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        {/* ネストした動的ルート */}
        <Route path="/workspaces/:workspaceId/tasks/:taskId" element={<.../>} />
      </Routes>
    </BrowserRouter>
  );
}
```

`src/client/pages/TaskDetailPage.tsx`:

```typescript
import { useParams } from 'react-router-dom';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  
  // パラメータを使ってAPIリクエスト
  const response = await client.tasks[':id'].$get({ param: { id } });
  // ...
}
```

### 3. サーバー側のフォールバック設定

重要なのは、サーバー側で**拡張子がないすべてのパス**を `index.html` にフォールバックさせることです：

```typescript
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  let pathname = url.pathname;

  // ルートパスまたは拡張子がないパス（SPAルート）は index.html を返す
  if (pathname === '/' || (!pathname.includes('.') && !pathname.startsWith('/api'))) {
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

  // 静的アセット（JS, CSS, 画像など）を配信
  const response = await c.env.ASSETS.fetch(assetRequest);
  return response;
});
```

この設定により：
- `/tasks/1` → `index.html` を返す → React Router が `/tasks/:id` にマッチ
- `/tasks/abc123` → `index.html` を返す → React Router が処理
- `/api/tasks/1` → Hono の動的ルートが処理
- `/assets/index.js` → 静的ファイルとして配信

## ルーティングの優先順位

Hono では、ルートの定義順序が重要です：

```typescript
// ❌ 間違った順序
app.get('/tasks/:id', handler1);      // 先に定義
app.get('/tasks/new', handler2);      // マッチしない！（:id が "new" をキャッチ）

// ✅ 正しい順序
app.get('/tasks/new', handler2);      // 具体的なパスを先に
app.get('/tasks/:id', handler1);      // 動的ルートは後に
```

## 動作確認

### APIエンドポイント（サーバーサイド）

```bash
# タスク一覧
$ curl https://maronn-taskchute.maronn.workers.dev/api/tasks
{"data":[{"id":"1","title":"..."},{"id":"2","title":"..."}]}

# 特定のタスク（動的ルート）
$ curl https://maronn-taskchute.maronn.workers.dev/api/tasks/1
{"data":{"id":"1","title":"プロジェクト設計書を作成",...}}

# 存在しないタスク
$ curl https://maronn-taskchute.maronn.workers.dev/api/tasks/999
{"error":{"code":"NOT_FOUND","message":"タスクが見つかりません"}}
```

### クライアントサイドルート

```bash
# ブラウザで直接アクセス可能
https://maronn-taskchute.maronn.workers.dev/tasks/1
→ index.html が返される → React Router が /tasks/:id をレンダリング

# どんなIDでもOK
https://maronn-taskchute.maronn.workers.dev/tasks/abc123
→ index.html が返される → React Router が処理
```

## その他の動的ルーティングパターン

### ワイルドカード

```typescript
// 任意の深さのパスにマッチ
app.get('/files/*', (c) => {
  const path = c.req.param('*');  // "files/" 以降のすべて
  console.log(path);  // "documents/report.pdf"
  // ...
});
```

### 複数パラメータ

```typescript
app.get('/workspaces/:workspaceId/tasks/:taskId', (c) => {
  const { workspaceId, taskId } = c.req.param();
  // ...
});
```

### オプショナルパラメータ

```typescript
// Honoでは正規表現を使用
app.get('/users/:id{[0-9]+}?', (c) => {
  const id = c.req.param('id');  // undefined の可能性あり
  // ...
});
```

### クエリパラメータ

```typescript
app.get('/search', (c) => {
  const query = c.req.query('q');
  const page = c.req.query('page') || '1';
  // /search?q=test&page=2
});
```

## まとめ

- Cloudflare Workers の **Assets 機能自体は静的ファイル配信のみ**
- **Hono を使えば完全な動的ルーティングが可能**
- サーバーサイド（API）とクライアントサイド（SPA）の両方で動的ルートを定義できる
- 重要なのは、サーバー側で拡張子がないパスを `index.html` にフォールバックさせること
- ルートの定義順序に注意（具体的 → 抽象的）

動的ルーティングは Assets の機能ではなく、**Worker スクリプト（Hono）の機能**として実装します。
