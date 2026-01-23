#!/bin/bash

set -e

echo "🔐 Auth0 セットアップを開始します..."

# カラー出力用
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Auth0 CLI がインストールされているか確認
if ! command -v auth0 &> /dev/null; then
  echo -e "${RED}Error: Auth0 CLI がインストールされていません${NC}"
  echo "以下のコマンドでインストールしてください："
  echo "  brew install auth0/auth0-cli/auth0  # macOS"
  echo "  curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh  # Linux"
  exit 1
fi

# Auth0にログインしているか確認
echo "Auth0にログインしているか確認します..."
if ! auth0 tenants list &> /dev/null; then
  echo "Auth0にログインしてください..."
  auth0 login
fi

# 環境変数の確認
ENVIRONMENT=${ENVIRONMENT:-development}
echo -e "${YELLOW}環境: ${ENVIRONMENT}${NC}"

# アプリケーション名とAPI識別子
if [ "$ENVIRONMENT" = "production" ]; then
  APP_NAME="TaskChute Web App"
  API_NAME="TaskChute API"
  DEFAULT_API_IDENTIFIER="https://api.taskchute.app"
else
  APP_NAME="TaskChute Web App (${ENVIRONMENT})"
  API_NAME="TaskChute API (${ENVIRONMENT})"
  DEFAULT_API_IDENTIFIER="https://api.taskchute.app/${ENVIRONMENT}"
fi

# API識別子の入力
echo ""
echo "API Identifier (Audience) を入力してください:"
echo -e "${YELLOW}デフォルト: ${DEFAULT_API_IDENTIFIER}${NC}"
echo "（空欄の場合はデフォルト値を使用します）"
read -r API_IDENTIFIER

if [ -z "$API_IDENTIFIER" ]; then
  API_IDENTIFIER="$DEFAULT_API_IDENTIFIER"
fi

echo -e "使用するAPI Identifier: ${YELLOW}$API_IDENTIFIER${NC}"

# コールバックURLの設定
echo ""
echo "コールバックURLを入力してください (例: http://localhost:8787/auth/callback,https://your-domain.workers.dev/auth/callback):"
read -r CALLBACK_URLS

if [ -z "$CALLBACK_URLS" ]; then
  echo -e "${RED}Error: コールバックURLは必須です${NC}"
  exit 1
fi

# ログアウトURLの設定
echo "ログアウトURLを入力してください (例: http://localhost:5173,https://your-domain.com):"
read -r LOGOUT_URLS

if [ -z "$LOGOUT_URLS" ]; then
  LOGOUT_URLS="http://localhost:5173"
fi

# Web OriginsとAllowed Origins (CORS)の設定
echo "Allowed Origins (CORS) を入力してください (例: http://localhost:5173,https://your-domain.com):"
read -r ALLOWED_ORIGINS

if [ -z "$ALLOWED_ORIGINS" ]; then
  ALLOWED_ORIGINS="http://localhost:5173"
fi

# APIの作成
echo ""
echo "📡 Auth0 APIを作成します..."

# 既存のAPIをチェック
EXISTING_API=$(auth0 apis list --json 2>/dev/null | jq -r ".[] | select(.identifier==\"$API_IDENTIFIER\") | .id" || echo "")

if [ -n "$EXISTING_API" ]; then
  echo -e "${YELLOW}API '$API_NAME' は既に存在します (Identifier: $API_IDENTIFIER)${NC}"
  API_ID="$EXISTING_API"
else
  echo "API '$API_NAME' を作成中..."

  # APIを作成（JSONレスポンスを取得）
  API_OUTPUT=$(auth0 apis create \
    --name "$API_NAME" \
    --identifier "$API_IDENTIFIER" \
    --scopes "read:tasks,write:tasks,read:workspaces,write:workspaces,read:comments,write:comments" \
    --token-lifetime 86400 \
    --offline-access \
    --json 2>/dev/null || echo "{}")

  API_ID=$(echo "$API_OUTPUT" | jq -r '.id // empty')

  if [ -z "$API_ID" ]; then
    echo -e "${YELLOW}Warning: APIの作成に失敗した可能性があります。既存のAPIを確認します...${NC}"
    sleep 2
    API_ID=$(auth0 apis list --json 2>/dev/null | jq -r ".[] | select(.identifier==\"$API_IDENTIFIER\") | .id" || echo "")
  fi

  if [ -n "$API_ID" ]; then
    echo -e "${GREEN}✓ Auth0 APIを作成しました: $API_NAME${NC}"
    echo -e "  Identifier: ${YELLOW}$API_IDENTIFIER${NC}"
  else
    echo -e "${RED}Error: APIの作成に失敗しました${NC}"
    exit 1
  fi
fi

# アプリケーションの作成
echo ""
echo "🔧 Auth0 アプリケーションを作成します..."

# 既存のアプリケーションをチェック
EXISTING_APP=$(auth0 apps list --json 2>/dev/null | jq -r ".[] | select(.name==\"$APP_NAME\") | .client_id" || echo "")

if [ -n "$EXISTING_APP" ]; then
  echo -e "${YELLOW}アプリケーション '$APP_NAME' は既に存在します${NC}"
  CLIENT_ID="$EXISTING_APP"

  # シークレットを取得（--reveal-secretsオプションでシークレットを表示）
  APP_DETAILS=$(auth0 apps show "$CLIENT_ID" --reveal-secrets --json 2>/dev/null)
  CLIENT_SECRET=$(echo "$APP_DETAILS" | jq -r '.client_secret // empty')
else
  echo "アプリケーション '$APP_NAME' を作成中..."

  # Regular Web Applicationとして作成
  APP_OUTPUT=$(auth0 apps create \
    --name "$APP_NAME" \
    --type regular \
    --callbacks "$CALLBACK_URLS" \
    --logout-urls "$LOGOUT_URLS" \
    --origins "$ALLOWED_ORIGINS" \
    --web-origins "$ALLOWED_ORIGINS" \
    --grants "authorization_code,refresh_token" \
    --json 2>/dev/null || echo "{}")

  CLIENT_ID=$(echo "$APP_OUTPUT" | jq -r '.client_id // empty')
  CLIENT_SECRET=$(echo "$APP_OUTPUT" | jq -r '.client_secret // empty')

  if [ -z "$CLIENT_ID" ]; then
    echo -e "${YELLOW}Warning: アプリケーションの作成に失敗した可能性があります。既存のアプリを確認します...${NC}"
    sleep 2
    CLIENT_ID=$(auth0 apps list --json 2>/dev/null | jq -r ".[] | select(.name==\"$APP_NAME\") | .client_id" || echo "")

    if [ -n "$CLIENT_ID" ]; then
      APP_DETAILS=$(auth0 apps show "$CLIENT_ID" --reveal-secrets --json 2>/dev/null)
      CLIENT_SECRET=$(echo "$APP_DETAILS" | jq -r '.client_secret // empty')
    fi
  fi

  if [ -n "$CLIENT_ID" ]; then
    echo -e "${GREEN}✓ Auth0 アプリケーションを作成しました: $APP_NAME${NC}"
    echo -e "  Client ID: ${YELLOW}$CLIENT_ID${NC}"
  else
    echo -e "${RED}Error: アプリケーションの作成に失敗しました${NC}"
    exit 1
  fi
fi

# Auth0ドメインを取得
AUTH0_DOMAIN=$(auth0 tenants list --json 2>/dev/null | jq -r '.[0].domain // empty')

if [ -z "$AUTH0_DOMAIN" ]; then
  echo -e "${RED}Error: Auth0ドメインの取得に失敗しました${NC}"
  exit 1
fi

# .env.local ファイルに保存
echo ""
echo "📝 環境変数を .env.local に保存します..."

cat > .env.local << EOF
# Auth0 Configuration
AUTH0_DOMAIN=${AUTH0_DOMAIN}
AUTH0_CLIENT_ID=${CLIENT_ID}
AUTH0_CLIENT_SECRET=${CLIENT_SECRET}
AUTH0_CALLBACK_URL=$(echo "$CALLBACK_URLS" | cut -d',' -f1)
AUTH0_AUDIENCE=${API_IDENTIFIER}

# Session
SESSION_SECRET=$(openssl rand -base64 32)
EOF

echo -e "${GREEN}✓ 環境変数を .env.local に保存しました${NC}"

# .dev.vars ファイルに保存（Wrangler開発用）
echo ""
echo "📝 環境変数を .dev.vars に保存します..."

cat > .dev.vars << EOF
# Auth0 Configuration
AUTH0_DOMAIN=${AUTH0_DOMAIN}
AUTH0_CLIENT_ID=${CLIENT_ID}
AUTH0_CLIENT_SECRET=${CLIENT_SECRET}
AUTH0_CALLBACK_URL=$(echo "$CALLBACK_URLS" | cut -d',' -f1)
AUTH0_AUDIENCE=${API_IDENTIFIER}

# Session
SESSION_SECRET=$(openssl rand -base64 32)

# Environment
ENVIRONMENT=development
EOF

echo -e "${GREEN}✓ 環境変数を .dev.vars に保存しました${NC}"

# Cloudflare Secretsにプッシュ
echo ""
echo "Cloudflare Secrets に環境変数をプッシュしますか？ (y/N)"
read -r PUSH_SECRETS

if [ "$PUSH_SECRETS" = "y" ] || [ "$PUSH_SECRETS" = "Y" ]; then
  echo ""
  echo "🔐 Cloudflare Secrets に環境変数をプッシュします..."

  echo "$AUTH0_DOMAIN" | wrangler secret put AUTH0_DOMAIN
  echo "$CLIENT_ID" | wrangler secret put AUTH0_CLIENT_ID
  echo "$CLIENT_SECRET" | wrangler secret put AUTH0_CLIENT_SECRET
  echo "$(echo "$CALLBACK_URLS" | cut -d',' -f2)" | wrangler secret put AUTH0_CALLBACK_URL
  echo "$API_IDENTIFIER" | wrangler secret put AUTH0_AUDIENCE
  echo "$(openssl rand -base64 32)" | wrangler secret put SESSION_SECRET

  echo -e "${GREEN}✓ Cloudflare Secrets にプッシュしました${NC}"
else
  echo "Cloudflare Secrets へのプッシュをスキップしました"
  echo ""
  echo "後でプッシュする場合は、以下のコマンドを実行してください："
  echo -e "${YELLOW}npm run push:secrets${NC}"
fi

# 設定情報を .auth0-config.json に保存
cat > .auth0-config.json << EOF
{
  "domain": "$AUTH0_DOMAIN",
  "clientId": "$CLIENT_ID",
  "audience": "$API_IDENTIFIER",
  "apiId": "$API_ID",
  "environment": "$ENVIRONMENT"
}
EOF

echo ""
echo -e "${GREEN}✅ Auth0セットアップが完了しました！${NC}"
echo ""
echo "作成された情報："
echo -e "  Auth0 Domain: ${YELLOW}$AUTH0_DOMAIN${NC}"
echo -e "  Client ID: ${YELLOW}$CLIENT_ID${NC}"
echo -e "  API Identifier: ${YELLOW}$API_IDENTIFIER${NC}"
echo ""
echo "環境変数ファイル："
echo "  - .env.local (開発環境用)"
echo "  - .dev.vars (Wrangler開発用)"
echo ""
echo "次のステップ："
echo "1. .env.local と .dev.vars の内容を確認してください"
echo "2. 開発サーバーを起動してください："
echo "   ${YELLOW}npm run dev${NC}"
