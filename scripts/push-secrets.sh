#!/bin/bash

set -e

echo "🔐 Cloudflare Secrets に環境変数をプッシュします..."

# カラー出力用
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# .env.local が存在するか確認
if [ ! -f ".env.local" ]; then
  echo -e "${RED}Error: .env.local ファイルが見つかりません${NC}"
  echo "先に Auth0 のセットアップを実行してください："
  echo "  npm run setup:auth0"
  exit 1
fi

# .env.local から環境変数を読み込み
set -a
source .env.local
set +a

# 必須の環境変数をチェック
REQUIRED_VARS=("AUTH0_DOMAIN" "AUTH0_CLIENT_ID" "AUTH0_CLIENT_SECRET" "AUTH0_CALLBACK_URL" "AUTH0_AUDIENCE" "SESSION_SECRET")

for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    echo -e "${RED}Error: $VAR が .env.local に設定されていません${NC}"
    exit 1
  fi
done

# 確認
echo "以下の環境変数をCloudflare Secretsにプッシュします："
echo -e "  AUTH0_DOMAIN: ${YELLOW}$AUTH0_DOMAIN${NC}"
echo -e "  AUTH0_CLIENT_ID: ${YELLOW}$AUTH0_CLIENT_ID${NC}"
echo -e "  AUTH0_CLIENT_SECRET: ${YELLOW}***${NC}"
echo -e "  AUTH0_CALLBACK_URL: ${YELLOW}$AUTH0_CALLBACK_URL${NC}"
echo -e "  AUTH0_AUDIENCE: ${YELLOW}$AUTH0_AUDIENCE${NC}"
echo -e "  SESSION_SECRET: ${YELLOW}***${NC}"
echo ""
echo "続行しますか？ (y/N)"
read -r CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "キャンセルしました"
  exit 0
fi

# Secretsをプッシュ
echo ""
echo "プッシュ中..."

echo "$AUTH0_DOMAIN" | wrangler secret put AUTH0_DOMAIN
echo "$AUTH0_CLIENT_ID" | wrangler secret put AUTH0_CLIENT_ID
echo "$AUTH0_CLIENT_SECRET" | wrangler secret put AUTH0_CLIENT_SECRET
echo "$AUTH0_CALLBACK_URL" | wrangler secret put AUTH0_CALLBACK_URL
echo "$AUTH0_AUDIENCE" | wrangler secret put AUTH0_AUDIENCE
echo "$SESSION_SECRET" | wrangler secret put SESSION_SECRET

echo ""
echo -e "${GREEN}✅ Cloudflare Secrets にプッシュしました！${NC}"
