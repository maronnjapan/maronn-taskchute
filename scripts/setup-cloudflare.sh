#!/bin/bash

set -e

echo "🚀 Cloudflare セットアップを開始します..."

# カラー出力用
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 環境変数の確認
ENVIRONMENT=${ENVIRONMENT:-development}

echo -e "${YELLOW}環境: ${ENVIRONMENT}${NC}"

# D1データベースの作成
echo ""
echo "📊 D1データベースを作成します..."

if [ "$ENVIRONMENT" = "production" ]; then
  DB_NAME="taskchute-db"
else
  DB_NAME="taskchute-db-${ENVIRONMENT}"
fi

# 既存のデータベースをチェック
EXISTING_DB=$(wrangler d1 list --json 2>/dev/null | jq -r ".[] | select(.name==\"$DB_NAME\") | .uuid" || echo "")

if [ -n "$EXISTING_DB" ]; then
  echo -e "${YELLOW}データベース '$DB_NAME' は既に存在します (ID: $EXISTING_DB)${NC}"
  DB_ID="$EXISTING_DB"
else
  echo "データベース '$DB_NAME' を作成中..."
  DB_OUTPUT=$(wrangler d1 create "$DB_NAME" --json)
  DB_ID=$(echo "$DB_OUTPUT" | jq -r '.uuid')
  echo -e "${GREEN}✓ D1データベースを作成しました: $DB_NAME (ID: $DB_ID)${NC}"
fi

# R2バケットの作成
echo ""
echo "📦 R2バケットを作成します..."

if [ "$ENVIRONMENT" = "production" ]; then
  BUCKET_NAME="taskchute-archive"
else
  BUCKET_NAME="taskchute-archive-${ENVIRONMENT}"
fi

# 既存のバケットをチェック
if wrangler r2 bucket list | grep -q "$BUCKET_NAME"; then
  echo -e "${YELLOW}バケット '$BUCKET_NAME' は既に存在します${NC}"
else
  echo "バケット '$BUCKET_NAME' を作成中..."
  wrangler r2 bucket create "$BUCKET_NAME"
  echo -e "${GREEN}✓ R2バケットを作成しました: $BUCKET_NAME${NC}"
fi

# wrangler.jsonc を更新
echo ""
echo "📝 wrangler.jsonc を更新します..."

# 一時ファイルに設定を書き込み
cat > .cloudflare-config.json << EOF
{
  "database_id": "$DB_ID",
  "database_name": "$DB_NAME",
  "bucket_name": "$BUCKET_NAME"
}
EOF

echo -e "${GREEN}✓ Cloudflare設定を .cloudflare-config.json に保存しました${NC}"

# wrangler.jsonc の更新
if command -v jq &> /dev/null; then
  echo ""
  echo "wrangler.jsonc のdatabase_idを更新してください："
  echo -e "${YELLOW}database_id: $DB_ID${NC}"
else
  echo -e "${YELLOW}jq がインストールされていないため、手動で wrangler.jsonc を更新してください${NC}"
fi

# マイグレーションの適用
echo ""
echo "🔄 マイグレーションを確認します..."

if [ -d "migrations" ] && [ "$(ls -A migrations/*.sql 2>/dev/null)" ]; then
  echo "マイグレーションファイルが見つかりました。適用しますか？ (y/N)"
  read -r APPLY_MIGRATIONS

  if [ "$APPLY_MIGRATIONS" = "y" ] || [ "$APPLY_MIGRATIONS" = "Y" ]; then
    if [ "$ENVIRONMENT" = "production" ]; then
      echo "本番環境にマイグレーションを適用します..."
      wrangler d1 migrations apply "$DB_NAME"
    else
      echo "ローカル環境にマイグレーションを適用します..."
      wrangler d1 migrations apply "$DB_NAME" --local
    fi
    echo -e "${GREEN}✓ マイグレーションを適用しました${NC}"
  else
    echo "マイグレーションをスキップしました"
  fi
else
  echo -e "${YELLOW}マイグレーションファイルが見つかりません${NC}"
fi

echo ""
echo -e "${GREEN}✅ Cloudflareセットアップが完了しました！${NC}"
echo ""
echo "次のステップ："
echo "1. wrangler.jsonc の database_id を以下に更新してください："
echo -e "   ${YELLOW}$DB_ID${NC}"
echo "2. Auth0のセットアップを実行してください："
echo "   ${YELLOW}npm run setup:auth0${NC}"
