# セットアップスクリプト

TaskChute Web AppのCloudflareとAuth0の環境をセットアップするためのスクリプト集です。

## 📋 前提条件

以下のツールがインストールされている必要があります：

- **Node.js** (v18以上)
- **pnpm** または **npm**
- **wrangler** - Cloudflare CLIツール
  ```bash
  npm install -g wrangler
  ```
- **jq** - JSONパーサー
  ```bash
  # macOS
  brew install jq

  # Ubuntu/Debian
  sudo apt-get install jq
  ```
- **auth0** - Auth0 CLIツール
  ```bash
  # macOS
  brew install auth0/auth0-cli/auth0

  # Linux
  curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh
  ```

## 🚀 使い方

### 一括セットアップ（推奨）

すべてのセットアップを一度に実行します：

```bash
npm run setup
```

このコマンドは以下を実行します：
1. Cloudflare D1データベースの作成
2. Cloudflare R2バケットの作成
3. Auth0 APIの作成
4. Auth0アプリケーションの作成
5. 環境変数ファイルの生成

### 個別セットアップ

#### 1. Cloudflareのみセットアップ

```bash
npm run setup:cloudflare
```

以下が作成されます：
- D1データベース
- R2バケット
- `.cloudflare-config.json` (設定ファイル)

#### 2. Auth0のみセットアップ

```bash
npm run setup:auth0
```

セットアップ時に以下の入力が求められます：
- **API Identifier (Audience)**: Auth0 APIの識別子（例: `https://api.taskchute.app`）
  - 空欄の場合は環境に応じたデフォルト値が使用されます
  - Production: `https://api.taskchute.app`
  - Development/Staging: `https://api.taskchute.app/{環境名}`
- **コールバックURL**: 認証後のリダイレクト先（複数可、カンマ区切り）
  - 例: `http://localhost:8787/auth/callback,https://your-domain.workers.dev/auth/callback`
- **ログアウトURL**: ログアウト後のリダイレクト先（複数可、カンマ区切り）
  - 例: `http://localhost:5173,https://your-domain.com`
- **Allowed Origins (CORS)**: クロスオリジンリクエストを許可するオリジン（複数可、カンマ区切り）
  - 例: `http://localhost:5173,https://your-domain.com`

以下が作成されます：
- Auth0 API（アクセストークンのpayloadに値を含めるため）
- Auth0アプリケーション（Regular Web Application）
- `.env.local` (環境変数ファイル)
- `.dev.vars` (Wrangler開発用環境変数ファイル)
- `.auth0-config.json` (設定ファイル)

Auth0 APIを作成することで、アクセストークンに以下のような情報が含まれます：
- `aud`: API識別子（指定したAPI Identifier）
- `scope`: 許可されたスコープ
- カスタムクレーム（必要に応じて追加可能）

#### 3. Cloudflare Secretsにプッシュ

本番環境にデプロイする前に、Auth0の認証情報をCloudflare Secretsにプッシュします：

```bash
npm run push:secrets
```

以下のシークレットがプッシュされます：
- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_CALLBACK_URL`
- `AUTH0_AUDIENCE`
- `SESSION_SECRET`

## 📁 生成されるファイル

### `.cloudflare-config.json`
Cloudflareの設定情報（D1データベースID、R2バケット名など）

```json
{
  "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "database_name": "taskchute-db",
  "bucket_name": "taskchute-archive"
}
```

### `.auth0-config.json`
Auth0の設定情報

```json
{
  "domain": "your-tenant.auth0.com",
  "clientId": "xxxxxxxxxxxxxxxxxxxx",
  "audience": "https://api.taskchute.app",
  "apiId": "xxxxxxxxxxxxxxxxxxxx",
  "environment": "development"
}
```

### `.env.local`
開発環境用の環境変数

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
AUTH0_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
AUTH0_CALLBACK_URL=http://localhost:8787/auth/callback
AUTH0_AUDIENCE=https://api.taskchute.app
SESSION_SECRET=xxxxxxxxxxxxxxxxxxxx
```

### `.dev.vars`
Wrangler開発サーバー用の環境変数（`.env.local`と同じ内容）

## 🔧 セットアップ後の手順

1. **wrangler.jsonc を更新**

   `.cloudflare-config.json` の `database_id` を `wrangler.jsonc` に反映します：

   ```jsonc
   {
     "d1_databases": [
       {
         "binding": "DB",
         "database_name": "taskchute-db",
         "database_id": "ここに.cloudflare-config.jsonのdatabase_idをコピー"
       }
     ]
   }
   ```

2. **マイグレーションを適用**（データベーススキーマを作成済みの場合）

   ```bash
   # ローカル環境
   wrangler d1 migrations apply taskchute-db --local

   # 本番環境
   wrangler d1 migrations apply taskchute-db
   ```

3. **開発サーバーを起動**

   ```bash
   npm run dev
   ```

   - クライアント: http://localhost:5173
   - サーバー: http://localhost:8787

## 🌍 環境別セットアップ

スクリプトは環境変数 `ENVIRONMENT` に基づいて、異なる環境をセットアップできます：

```bash
# Development環境（デフォルト）
ENVIRONMENT=development npm run setup

# Staging環境
ENVIRONMENT=staging npm run setup

# Production環境
ENVIRONMENT=production npm run setup
```

各環境で以下のリソースが分離されます：
- D1データベース名: `taskchute-db-{environment}`
- R2バケット名: `taskchute-archive-{environment}`
- Auth0アプリ名: `TaskChute Web App ({environment})`
- Auth0 API名: `TaskChute API ({environment})`

## 🔒 Auth0 API の設定

セットアップスクリプトは以下のスコープを持つAuth0 APIを自動作成します：

- `read:tasks` - タスクの読み取り
- `write:tasks` - タスクの作成・更新・削除
- `read:workspaces` - ワークスペースの読み取り
- `write:workspaces` - ワークスペースの作成・更新・削除
- `read:comments` - コメントの読み取り
- `write:comments` - コメントの作成・更新・削除

### API Identifier (Audience) のカスタマイズ

セットアップ時に API Identifier を指定できます。これは以下の用途で使用されます：

- **アクセストークンの `aud` クレーム**: トークンの対象APIを識別
- **トークン検証**: バックエンドでトークンの有効性を確認
- **マルチテナント対応**: 環境ごとに異なるAPIを作成

デフォルト値：
- Production: `https://api.taskchute.app`
- Development: `https://api.taskchute.app/development`
- Staging: `https://api.taskchute.app/staging`

独自のドメインを使用する場合は、セットアップ時に指定してください（例: `https://api.example.com`）。

APIを作成することで、アクセストークンに `aud`（audience）クレームが含まれ、トークンの検証が可能になります。

## 🐛 トラブルシューティング

### Auth0 CLIにログインできない

```bash
auth0 login
```

ブラウザが開くので、Auth0にログインしてください。

### Cloudflare にログインできない

```bash
wrangler login
```

ブラウザが開くので、Cloudflareにログインしてください。

### データベースIDが wrangler.jsonc に反映されない

`.cloudflare-config.json` の `database_id` を手動で `wrangler.jsonc` にコピーしてください。

### Secretsのプッシュに失敗する

`.env.local` ファイルが存在し、すべての必須環境変数が設定されているか確認してください：

```bash
cat .env.local
```

## 📚 参考リンク

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Auth0 CLI Documentation](https://github.com/auth0/auth0-cli)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
