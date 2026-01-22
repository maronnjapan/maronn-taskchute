# TaskChute Web App - CLAUDE.md

## プロジェクト概要

タスクシュート方式の時間記録・管理ができるWebアプリケーション。
高速な表示とオフライン対応を重視し、ネットワーク状況に依存しない操作性を実現する。

## 技術スタック

### バックエンド
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (古いデータのアーカイブ用)
- **認証**: Auth0 (サーバーサイドセッション管理)

### フロントエンド
- **Framework**: React 18+
- **Build Tool**: Vite
- **Routing**: React Router
- **State Management**: 軽量なもの（Zustand推奨）
- **Styling**: Tailwind CSS
- **オフライン対応**: Service Worker + localStorage キュー

### 構成
- 単一パッケージ構成（将来的なモノレポ分離を考慮）
- `src/client/` と `src/server/` で明確に分離
- 共有型定義は `src/shared/` に配置

## ディレクトリ構成

```
/
├── src/
│   ├── client/                 # フロントエンド（React SPA）
│   │   ├── components/         # UIコンポーネント
│   │   │   ├── ui/            # 汎用UIコンポーネント
│   │   │   └── features/      # 機能別コンポーネント
│   │   ├── hooks/             # カスタムフック
│   │   ├── stores/            # 状態管理（Zustand）
│   │   ├── services/          # API通信・同期処理
│   │   ├── pages/             # ページコンポーネント
│   │   ├── utils/             # ユーティリティ
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── sw.ts              # Service Worker
│   │
│   ├── server/                 # バックエンド（Hono on Workers）
│   │   ├── routes/            # APIルート
│   │   ├── middleware/        # ミドルウェア（認証等）
│   │   ├── services/          # ビジネスロジック
│   │   ├── repositories/      # データアクセス層
│   │   └── index.ts           # エントリーポイント
│   │
│   └── shared/                 # 共有コード
│       ├── types/             # 型定義
│       ├── constants/         # 定数
│       └── validators/        # バリデーション（zodスキーマ等）
│
├── public/                     # 静的ファイル
├── migrations/                 # D1マイグレーション
├── scripts/                    # ビルド・デプロイスクリプト
├── wrangler.jsonc              # Cloudflare Workers設定
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## ビルド・開発サーバー設定

### ローカル開発

クライアントとサーバーを別プロセスで起動し、Vite のプロキシで接続する。

```bash
# 同時起動
npm run dev  # concurrently で両方起動

# 個別起動
npm run dev:client  # → localhost:5173
npm run dev:server  # → localhost:8787
```

**vite.config.ts**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/auth': 'http://localhost:8787',
    },
  },
});
```

### 本番ビルド

```bash
# 1. クライアントビルド（Vite）
vite build  # → dist/client/

# 2. サーバービルド（esbuild）
esbuild src/server/index.ts \
  --bundle \
  --platform=neutral \
  --outfile=dist/server/index.js

# 3. デプロイ
wrangler deploy
```

### フロントエンドルーティング（SPA対応）

React Router によるクライアントサイドルーティングをサポートする。
`/tasks`, `/settings` 等の直接アクセス時も `index.html` を返し、React Router がルーティングを処理する。

**src/server/index.ts**
```typescript
import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import api from './routes/api';
import auth from './routes/auth';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  // ...
};

const app = new Hono<{ Bindings: Bindings }>();

// APIルート（先にマッチさせる）
app.route('/api', api);
app.route('/auth', auth);

// 静的アセット（JS, CSS, 画像等）
app.use('/assets/*', serveStatic({ root: './' }));
app.use('/favicon.ico', serveStatic({ path: './favicon.ico' }));

// SPA フォールバック（その他すべてのパスは index.html を返す）
// これにより React Router がクライアントサイドでルーティングを処理できる
app.get('*', async (c) => {
  return c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url)));
});

export default app;
```

**src/client/App.tsx**
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TaskListPage } from './pages/TaskListPage';
import { SettingsPage } from './pages/SettingsPage';
import { SharedWorkspacePage } from './pages/SharedWorkspacePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TaskListPage />} />
        <Route path="/tasks" element={<TaskListPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/s/:shareToken" element={<SharedWorkspacePage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## データモデル

### 主要エンティティ

```typescript
// ユーザー（Auth0から取得した情報をキャッシュ）
interface User {
  id: string;              // UUID
  auth0Id: string;         // Auth0のsub
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// ワークスペース（共有リンク単位）
interface Workspace {
  id: string;              // UUID
  ownerId: string;         // User.id
  shareToken: string;      // 共有用トークン（URLに使用）
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// タスク
interface Task {
  id: string;              // UUID
  workspaceId: string;
  title: string;
  description?: string;    // Markdown対応
  scheduledDate: string;   // YYYY-MM-DD
  sortOrder: number;       // 並び順
  estimatedMinutes?: number;
  actualMinutes?: number;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'carried_over';
  createdAt: Date;
  updatedAt: Date;
}

// タスクコメント
interface TaskComment {
  id: string;
  taskId: string;
  content: string;         // Markdown
  createdAt: Date;
  updatedAt: Date;
}

// アーカイブ済みタスク（R2に退避後の参照用）
interface ArchivedTaskBatch {
  id: string;
  workspaceId: string;
  yearMonth: string;       // YYYY-MM
  r2Key: string;           // R2オブジェクトキー
  taskCount: number;
  archivedAt: Date;
}
```

### D1テーブル設計方針

- `id` は全てUUID v7（時系列ソート可能）
- `createdAt`, `updatedAt` は Unix timestamp (INTEGER)
- インデックスは `workspaceId + scheduledDate` の複合インデックスを重視
- 1ヶ月以上前のデータはバッチでR2に退避し、D1からは削除

## 認証フロー

### Auth0連携（サーバーサイドのみ）

```
1. ユーザーが /login にアクセス
2. サーバーがAuth0の認可エンドポイントにリダイレクト
3. Auth0での認証後、/callback にリダイレクト
4. サーバーがAuth0からトークンを取得（フロントには渡さない）
5. セッションを生成し、HTTPOnly Cookieで管理
6. フロントにはセッションIDのみ（Cookieで自動送信）
```

### セッション管理

- セッション情報はD1に保存（`sessions`テーブル）
- セッション有効期限: 7日（スライディング）
- Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`

### 共有リンクアクセス

- `/s/:shareToken` でアクセス
- 認証不要、shareTokenの有効性のみ検証
- 閲覧・編集ともに可能
- オーナーはshareTokenを再生成可能

## API設計

### エンドポイント一覧

```
# 認証
GET  /auth/login              # Auth0へリダイレクト
GET  /auth/callback           # Auth0からのコールバック
POST /auth/logout             # ログアウト
GET  /auth/me                 # 現在のユーザー情報

# ワークスペース
GET    /api/workspaces                    # 自分のワークスペース一覧
POST   /api/workspaces                    # 新規作成
GET    /api/workspaces/:id                # 詳細取得
PATCH  /api/workspaces/:id                # 更新
DELETE /api/workspaces/:id                # 削除
POST   /api/workspaces/:id/regenerate-token  # 共有トークン再生成

# 共有アクセス
GET    /api/s/:shareToken                 # 共有ワークスペース取得

# タスク
GET    /api/workspaces/:id/tasks          # タスク一覧（日付でフィルタ）
POST   /api/workspaces/:id/tasks          # タスク作成
GET    /api/workspaces/:id/tasks/:taskId  # タスク詳細
PATCH  /api/workspaces/:id/tasks/:taskId  # タスク更新
DELETE /api/workspaces/:id/tasks/:taskId  # タスク削除
POST   /api/workspaces/:id/tasks/reorder  # 並び替え
POST   /api/workspaces/:id/tasks/carry-over  # 繰り越し処理

# タスクコメント
GET    /api/tasks/:taskId/comments        # コメント一覧
POST   /api/tasks/:taskId/comments        # コメント追加
PATCH  /api/comments/:commentId           # コメント更新
DELETE /api/comments/:commentId           # コメント削除

# エクスポート
GET    /api/workspaces/:id/export/csv     # CSV出力
GET    /api/workspaces/:id/export/json    # JSON出力（API提供用）

# バッチ（内部/cron用）
POST   /api/internal/archive              # 古いデータのR2退避
POST   /api/internal/batch-sync           # 外部連携用バッチ処理
```

### レスポンス形式

```typescript
// 成功時
{
  "data": T,
  "meta"?: {
    "total"?: number,
    "page"?: number,
    "hasMore"?: boolean
  }
}

// エラー時
{
  "error": {
    "code": string,
    "message": string,
    "details"?: unknown
  }
}
```

## オフライン対応

### 同期戦略

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   React     │────▶│  SyncQueue   │────▶│   Server    │
│   State     │◀────│ (localStorage)│◀────│   (D1)      │
└─────────────┘     └──────────────┘     └─────────────┘
```

1. **楽観的更新**: UIは即座に更新、バックグラウンドでサーバー同期
2. **SyncQueue**: localStorageに操作キューを保存
3. **リトライ**: 失敗時は指数バックオフでリトライ
4. **競合解決**: Last Write Wins（updatedAtベース）

### SyncQueueの実装方針

```typescript
interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'task' | 'comment';
  payload: unknown;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
}
```

- オンライン復帰時に自動同期
- 定期的なポーリング（30秒間隔）
- `navigator.onLine` と `online/offline` イベントで検知

### Service Worker

- Viteの `vite-plugin-pwa` を使用
- APIレスポンスのキャッシュ（stale-while-revalidate）
- 静的アセットのプリキャッシュ

## 開発ガイドライン

### コーディング規約

- TypeScript strict mode必須
- ESLint + Prettier設定に従う
- 命名規則
  - コンポーネント: PascalCase
  - 関数・変数: camelCase
  - 定数: UPPER_SNAKE_CASE
  - ファイル: kebab-case（コンポーネントファイルのみPascalCase）

### React実装規約

#### useEffect使用禁止

**`useEffect` の使用は禁止する。** 代替として以下のライブラリ・パターンを使用すること。

| ユースケース | 代替手段 |
|-------------|---------|
| データフェッチ | TanStack Query (`useQuery`, `useMutation`) |
| 外部ストアとの同期 | `useSyncExternalStore` |
| イベントリスナー登録 | カスタムフック + `useSyncExternalStore` |
| DOM操作 | `ref` + イベントハンドラ |
| 状態の派生 | `useMemo` または Zustand の computed |
| マウント時の処理 | TanStack Query または Zustand の初期化 |

#### 推奨ライブラリ

```typescript
// データフェッチ・サーバー状態管理
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// クライアント状態管理
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// フォーム管理
import { useForm } from 'react-hook-form';
```

#### useEffect禁止の例外

以下の場合のみ、PRレビューで承認を得た上で使用可：
- サードパーティライブラリが内部的に要求する場合
- 上記代替手段では実現不可能な特殊ケース

その場合でも、必ずコメントで理由を明記すること：

```typescript
// WARNING: useEffect使用 - 理由: [具体的な理由]
// 代替手段を検討済み: [検討した代替手段と不採用理由]
```

#### ESLint設定

```javascript
// eslint.config.js
{
  rules: {
    'react-hooks/exhaustive-deps': 'off', // useEffect禁止のため不要
    'no-restricted-imports': ['error', {
      paths: [{
        name: 'react',
        importNames: ['useEffect', 'useLayoutEffect'],
        message: 'useEffect/useLayoutEffectは禁止です。TanStack QueryまたはZustandを使用してください。'
      }]
    }]
  }
}
```

### TDD（テスト駆動開発）

#### 開発サイクル

すべての機能実装はTDDサイクルに従う：

```
Red → Green → Refactor
```

1. **Red**: 失敗するテストを先に書く
2. **Green**: テストが通る最小限の実装を行う
3. **Refactor**: コードを整理・改善する（テストは通ったまま）

#### 実装手順

新機能を実装する際は、必ず以下の順序で行う：

```bash
# 1. テストファイルを作成
touch src/server/services/__tests__/task-service.test.ts

# 2. 失敗するテストを書く
npm run test -- --watch task-service

# 3. テストが通る実装を書く
# 4. リファクタリング
# 5. 次のテストケースへ
```

#### テスト粒度

| レイヤー | テスト対象 | ツール |
|---------|-----------|--------|
| Unit | 関数、クラス、フック | Vitest |
| Integration | API エンドポイント | Vitest + Hono test helper |
| Component | React コンポーネント | Vitest + Testing Library |
| E2E | ユーザーフロー | Playwright |

#### テストファイル配置

```
src/
├── server/
│   ├── services/
│   │   ├── task-service.ts
│   │   └── __tests__/
│   │       └── task-service.test.ts
│   └── routes/
│       ├── tasks.ts
│       └── __tests__/
│           └── tasks.test.ts
├── client/
│   ├── components/
│   │   ├── TaskItem.tsx
│   │   └── __tests__/
│   │       └── TaskItem.test.tsx
│   └── hooks/
│       ├── use-tasks.ts
│       └── __tests__/
│           └── use-tasks.test.ts
```

#### テスト記述のルール

```typescript
// describe: 対象を明確に
describe('TaskService', () => {
  // describe: メソッドやシナリオ単位
  describe('createTask', () => {
    // it: 期待する振る舞いを日本語で
    it('タイトルと日付を指定してタスクを作成できる', async () => {
      // Arrange
      const input = { title: 'テストタスク', scheduledDate: '2024-01-15' };
      
      // Act
      const result = await taskService.createTask(input);
      
      // Assert
      expect(result.title).toBe('テストタスク');
      expect(result.status).toBe('pending');
    });

    it('タイトルが空の場合はエラーを返す', async () => {
      // Arrange
      const input = { title: '', scheduledDate: '2024-01-15' };
      
      // Act & Assert
      await expect(taskService.createTask(input))
        .rejects.toThrow('タイトルは必須です');
    });
  });
});
```

#### コミット前チェック

```bash
# 全テスト実行（CI/pre-commit hook で実行）
npm run test

# カバレッジ確認
npm run test:coverage
```

#### カバレッジ目標

- サーバーサイド（services, repositories）: 90%以上
- クライアントサイド（hooks, utils）: 80%以上
- コンポーネント: 70%以上（主要なインタラクションをカバー）

### コミットメッセージ

```
<type>(<scope>): <subject>

type: feat, fix, docs, style, refactor, test, chore
scope: client, server, shared, config
```

### テストツール

- ユニットテスト: Vitest
- コンポーネントテスト: Vitest + React Testing Library
- E2Eテスト: Playwright（主要フローのみ）
- APIテスト: Honoのテストヘルパー + Vitest
- モック: vitest の `vi.mock()` / MSW（API モック）

### 環境変数

```
# .dev.vars（ローカル開発用）
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_CALLBACK_URL=
SESSION_SECRET=

# TaskChute Web App - CLAUDE.md

## プロジェクト概要

タスクシュート方式の時間記録・管理ができるWebアプリケーション。
高速な表示とオフライン対応を重視し、ネットワーク状況に依存しない操作性を実現する。

## 技術スタック

### バックエンド
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (古いデータのアーカイブ用)
- **認証**: Auth0 (サーバーサイドセッション管理)

### フロントエンド
- **Framework**: React 18+
- **Build Tool**: Vite
- **Routing**: React Router
- **State Management**: 軽量なもの（Zustand推奨）
- **Styling**: Tailwind CSS
- **オフライン対応**: Service Worker + localStorage キュー

### 構成
- 単一パッケージ構成（将来的なモノレポ分離を考慮）
- `src/client/` と `src/server/` で明確に分離
- 共有型定義は `src/shared/` に配置

## ディレクトリ構成

```
/
├── src/
│   ├── client/                 # フロントエンド（React SPA）
│   │   ├── components/         # UIコンポーネント
│   │   │   ├── ui/            # 汎用UIコンポーネント
│   │   │   └── features/      # 機能別コンポーネント
│   │   ├── hooks/             # カスタムフック
│   │   ├── stores/            # 状態管理（Zustand）
│   │   ├── services/          # API通信・同期処理
│   │   ├── pages/             # ページコンポーネント
│   │   ├── utils/             # ユーティリティ
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── sw.ts              # Service Worker
│   │
│   ├── server/                 # バックエンド（Hono on Workers）
│   │   ├── routes/            # APIルート
│   │   ├── middleware/        # ミドルウェア（認証等）
│   │   ├── services/          # ビジネスロジック
│   │   ├── repositories/      # データアクセス層
│   │   └── index.ts           # エントリーポイント
│   │
│   └── shared/                 # 共有コード
│       ├── types/             # 型定義
│       ├── constants/         # 定数
│       └── validators/        # バリデーション（zodスキーマ等）
│
├── public/                     # 静的ファイル
├── migrations/                 # D1マイグレーション
├── scripts/                    # ビルド・デプロイスクリプト
├── wrangler.jsonc              # Cloudflare Workers設定
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## ビルド・開発サーバー設定

### ローカル開発

クライアントとサーバーを別プロセスで起動し、Vite のプロキシで接続する。

```bash
# 同時起動
npm run dev  # concurrently で両方起動

# 個別起動
npm run dev:client  # → localhost:5173
npm run dev:server  # → localhost:8787
```

**vite.config.ts**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/auth': 'http://localhost:8787',
    },
  },
});
```

### 本番ビルド

```bash
# 1. クライアントビルド（Vite）
vite build  # → dist/client/

# 2. サーバービルド（esbuild）
esbuild src/server/index.ts \
  --bundle \
  --platform=neutral \
  --outfile=dist/server/index.js

# 3. デプロイ
wrangler deploy
```

### フロントエンドルーティング（SPA対応）

React Router によるクライアントサイドルーティングをサポートする。
`/tasks`, `/settings` 等の直接アクセス時も `index.html` を返し、React Router がルーティングを処理する。

**src/server/index.ts**
```typescript
import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import api from './routes/api';
import auth from './routes/auth';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  // ...
};

const app = new Hono<{ Bindings: Bindings }>();

// APIルート（先にマッチさせる）
app.route('/api', api);
app.route('/auth', auth);

// 静的アセット（JS, CSS, 画像等）
app.use('/assets/*', serveStatic({ root: './' }));
app.use('/favicon.ico', serveStatic({ path: './favicon.ico' }));

app.get('*', async (c) => {
  const url = new URL(c.req.url);
  const pathname = url.pathname;

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
```

**src/client/App.tsx**
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TaskListPage } from './pages/TaskListPage';
import { SettingsPage } from './pages/SettingsPage';
import { SharedWorkspacePage } from './pages/SharedWorkspacePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TaskListPage />} />
        <Route path="/tasks" element={<TaskListPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/s/:shareToken" element={<SharedWorkspacePage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## データモデル

### 主要エンティティ

```typescript
// ユーザー（Auth0から取得した情報をキャッシュ）
interface User {
  id: string;              // UUID
  auth0Id: string;         // Auth0のsub
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// ワークスペース（共有リンク単位）
interface Workspace {
  id: string;              // UUID
  ownerId: string;         // User.id
  shareToken: string;      // 共有用トークン（URLに使用）
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// タスク
interface Task {
  id: string;              // UUID
  workspaceId: string;
  title: string;
  description?: string;    // Markdown対応
  scheduledDate: string;   // YYYY-MM-DD
  sortOrder: number;       // 並び順
  estimatedMinutes?: number;
  actualMinutes?: number;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'carried_over';
  createdAt: Date;
  updatedAt: Date;
}

// タスクコメント
interface TaskComment {
  id: string;
  taskId: string;
  content: string;         // Markdown
  createdAt: Date;
  updatedAt: Date;
}

// アーカイブ済みタスク（R2に退避後の参照用）
interface ArchivedTaskBatch {
  id: string;
  workspaceId: string;
  yearMonth: string;       // YYYY-MM
  r2Key: string;           // R2オブジェクトキー
  taskCount: number;
  archivedAt: Date;
}
```

### D1テーブル設計方針

- `id` は全てUUID v7（時系列ソート可能）
- `createdAt`, `updatedAt` は Unix timestamp (INTEGER)
- インデックスは `workspaceId + scheduledDate` の複合インデックスを重視
- 1ヶ月以上前のデータはバッチでR2に退避し、D1からは削除

## 認証フロー

### Auth0連携（サーバーサイドのみ）

```
1. ユーザーが /login にアクセス
2. サーバーがAuth0の認可エンドポイントにリダイレクト
3. Auth0での認証後、/callback にリダイレクト
4. サーバーがAuth0からトークンを取得（フロントには渡さない）
5. セッションを生成し、HTTPOnly Cookieで管理
6. フロントにはセッションIDのみ（Cookieで自動送信）
```

### セッション管理

- セッション情報はD1に保存（`sessions`テーブル）
- セッション有効期限: 7日（スライディング）
- Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`

### 共有リンクアクセス

- `/s/:shareToken` でアクセス
- 認証不要、shareTokenの有効性のみ検証
- 閲覧・編集ともに可能
- オーナーはshareTokenを再生成可能

## API設計

### エンドポイント一覧

```
# 認証
GET  /auth/login              # Auth0へリダイレクト
GET  /auth/callback           # Auth0からのコールバック
POST /auth/logout             # ログアウト
GET  /auth/me                 # 現在のユーザー情報

# ワークスペース
GET    /api/workspaces                    # 自分のワークスペース一覧
POST   /api/workspaces                    # 新規作成
GET    /api/workspaces/:id                # 詳細取得
PATCH  /api/workspaces/:id                # 更新
DELETE /api/workspaces/:id                # 削除
POST   /api/workspaces/:id/regenerate-token  # 共有トークン再生成

# 共有アクセス
GET    /api/s/:shareToken                 # 共有ワークスペース取得

# タスク
GET    /api/workspaces/:id/tasks          # タスク一覧（日付でフィルタ）
POST   /api/workspaces/:id/tasks          # タスク作成
GET    /api/workspaces/:id/tasks/:taskId  # タスク詳細
PATCH  /api/workspaces/:id/tasks/:taskId  # タスク更新
DELETE /api/workspaces/:id/tasks/:taskId  # タスク削除
POST   /api/workspaces/:id/tasks/reorder  # 並び替え
POST   /api/workspaces/:id/tasks/carry-over  # 繰り越し処理

# タスクコメント
GET    /api/tasks/:taskId/comments        # コメント一覧
POST   /api/tasks/:taskId/comments        # コメント追加
PATCH  /api/comments/:commentId           # コメント更新
DELETE /api/comments/:commentId           # コメント削除

# エクスポート
GET    /api/workspaces/:id/export/csv     # CSV出力
GET    /api/workspaces/:id/export/json    # JSON出力（API提供用）

# バッチ（内部/cron用）
POST   /api/internal/archive              # 古いデータのR2退避
POST   /api/internal/batch-sync           # 外部連携用バッチ処理
```

### レスポンス形式

```typescript
// 成功時
{
  "data": T,
  "meta"?: {
    "total"?: number,
    "page"?: number,
    "hasMore"?: boolean
  }
}

// エラー時
{
  "error": {
    "code": string,
    "message": string,
    "details"?: unknown
  }
}
```

## オフライン対応

### 同期戦略

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   React     │────▶│  SyncQueue   │────▶│   Server    │
│   State     │◀────│ (localStorage)│◀────│   (D1)      │
└─────────────┘     └──────────────┘     └─────────────┘
```

1. **楽観的更新**: UIは即座に更新、バックグラウンドでサーバー同期
2. **SyncQueue**: localStorageに操作キューを保存
3. **リトライ**: 失敗時は指数バックオフでリトライ
4. **競合解決**: Last Write Wins（updatedAtベース）

### SyncQueueの実装方針

```typescript
interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'task' | 'comment';
  payload: unknown;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
}
```

- オンライン復帰時に自動同期
- 定期的なポーリング（30秒間隔）
- `navigator.onLine` と `online/offline` イベントで検知

### Service Worker

- Viteの `vite-plugin-pwa` を使用
- APIレスポンスのキャッシュ（stale-while-revalidate）
- 静的アセットのプリキャッシュ

## 開発ガイドライン

### コーディング規約

- TypeScript strict mode必須
- ESLint + Prettier設定に従う
- 命名規則
  - コンポーネント: PascalCase
  - 関数・変数: camelCase
  - 定数: UPPER_SNAKE_CASE
  - ファイル: kebab-case（コンポーネントファイルのみPascalCase）

### React実装規約

#### useEffect使用禁止

**`useEffect` の使用は禁止する。** 代替として以下のライブラリ・パターンを使用すること。

| ユースケース | 代替手段 |
|-------------|---------|
| データフェッチ | TanStack Query (`useQuery`, `useMutation`) |
| 外部ストアとの同期 | `useSyncExternalStore` |
| イベントリスナー登録 | カスタムフック + `useSyncExternalStore` |
| DOM操作 | `ref` + イベントハンドラ |
| 状態の派生 | `useMemo` または Zustand の computed |
| マウント時の処理 | TanStack Query または Zustand の初期化 |

#### 推奨ライブラリ

```typescript
// データフェッチ・サーバー状態管理
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// クライアント状態管理
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// フォーム管理
import { useForm } from 'react-hook-form';
```

#### useEffect禁止の例外

以下の場合のみ、PRレビューで承認を得た上で使用可：
- サードパーティライブラリが内部的に要求する場合
[vars]
ENVIRONMENT = "development"
```

## デプロイ

### Cloudflare設定

```jsonc
// wrangler.jsonc
{
  "name": "taskchute-web",
  "main": "dist/server/index.js",
  "compatibility_date": "2024-01-01",
  "site": {
    "bucket": "./dist/client"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "taskchute-db",
      "database_id": "<database-id>"
    }
  ],
  "r2_buckets": [
    {
      "binding": "ARCHIVE",
      "bucket_name": "taskchute-archive"
    }
  ],
  "triggers": {
    "crons": ["0 3 * * *"]  // 毎日3:00にアーカイブ処理
  }
}
```

### デプロイコマンド（手動）

```bash
# ビルド
npm run build

# D1マイグレーション
npx wrangler d1 migrations apply taskchute-db

# デプロイ
npx wrangler deploy
```

### package.json スクリプト

```json
{
  "scripts": {
    "dev": "concurrently \"pnpm run dev:client\" \"pnpm run dev:server\"",
    "dev:client": "vite",
    "dev:server": "wrangler dev",
    "build": "vite build && pnpm run build:server",
    "build:server": "esbuild src/server/index.ts --bundle --platform=neutral --conditions=workerd --outfile=dist/server/index.js --format=esm --minify --external:node:*",
    "deploy": "pnpm run build && wrangler deploy",
    "typecheck": "tsc",
    "gen:wrangler:types": "wrangler types",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "test": "vitest",
    "test:ci": "vitest run",
    "test:coverage": "vitest run --coverage"
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

### ブランチ保護ルール

GitHub リポジトリの Settings > Branches で `main` ブランチに以下を設定：

- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
  - 必須チェック: `test`, `e2e`
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings

### マイグレーション運用ルール

1. **マイグレーションファイルの命名規則**
   ```
   migrations/
   ├── 0001_create_users.sql
   ├── 0002_create_workspaces.sql
   ├── 0003_create_tasks.sql
   └── 0004_add_task_comments.sql
   ```

2. **マイグレーション作成手順**
   ```bash
   # 新しいマイグレーションファイルを作成
   touch migrations/NNNN_description.sql
   
   # ローカルで適用テスト
   npx wrangler d1 migrations apply taskchute-db --local
   
   # 動作確認後、コミット
   git add migrations/
   git commit -m "chore(db): add migration NNNN_description"
   ```

3. **ロールバック方針**
   - D1は自動ロールバック非対応
   - 問題発生時は「修正マイグレーション」を追加で作成
   - 破壊的変更は段階的に実施（カラム追加 → データ移行 → 旧カラム削除）

### デプロイフロー図

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Feature     │     │    Pull      │     │    Main      │
│  Branch      │────▶│   Request    │────▶│   Branch     │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                     │
                            ▼                     ▼
                     ┌──────────────┐     ┌──────────────┐
                     │   CI Tests   │     │   Deploy     │
                     │  - typecheck │     │  - migrate   │
                     │  - lint      │     │  - deploy    │
                     │  - unit test │     └──────────────┘
                     │  - e2e test  │
                     └──────────────┘
```

## 実装の優先順位

### Phase 1: MVP（必須機能）
1. プロジェクト初期セットアップ
   - Vitest / Playwright 設定
   - GitHub ブランチ保護ルール設定
   - Cloudflare D1 / R2 / Workers 初期設定
2. Auth0認証フロー
3. 基本的なタスクCRUD
4. 日次タスクリスト表示
5. 時間記録（見積もり・実績）
6. オフライン対応（SyncQueue）
7. 共有リンク機能
8. ドラッグ&ドロップ並び替え
9. タスク繰り越し機能

### Phase 2: あると良い機能
3. CSVエクスポート
4. タスクコメント（Markdown）
5. データ取得API
6. 古いデータのR2アーカイブ

### Phase 3: 将来拡張
1. 統計・分析ダッシュボード
2. バッチ連携機能
3. パフォーマンス最適化

## トラブルシューティング

### よくある問題

1. **D1の接続エラー**
   - `wrangler dev --local --persist` でローカルD1を使用
   - マイグレーションが適用されているか確認

2. **Auth0コールバックエラー**
   - Allowed Callback URLsの設定確認
   - `AUTH0_CALLBACK_URL` が正しいか確認

3. **オフライン同期の競合**
   - コンソールでSyncQueueの状態を確認
   - `localStorage.getItem('sync-queue')` でキュー内容を確認

## 参考リンク

- [Hono Documentation](https://hono.dev/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Auth0 Documentation](https://auth0.com/docs)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
