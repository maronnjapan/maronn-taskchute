#!/bin/bash

set -e

echo "🚀 TaskChute セットアップを開始します..."
echo ""

# カラー出力用
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 環境の選択
echo "セットアップする環境を選択してください："
echo "  1) development (デフォルト)"
echo "  2) staging"
echo "  3) production"
read -p "選択 (1-3): " ENV_CHOICE

case $ENV_CHOICE in
  2)
    export ENVIRONMENT="staging"
    ;;
  3)
    export ENVIRONMENT="production"
    ;;
  *)
    export ENVIRONMENT="development"
    ;;
esac

echo -e "${YELLOW}環境: $ENVIRONMENT${NC}"
echo ""

# 必要なツールのチェック
echo "必要なツールをチェックします..."

MISSING_TOOLS=()

if ! command -v wrangler &> /dev/null; then
  MISSING_TOOLS+=("wrangler")
fi

if ! command -v jq &> /dev/null; then
  MISSING_TOOLS+=("jq")
fi

if ! command -v auth0 &> /dev/null; then
  MISSING_TOOLS+=("auth0")
fi

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
  echo -e "${RED}Error: 以下のツールがインストールされていません：${NC}"
  for TOOL in "${MISSING_TOOLS[@]}"; do
    echo "  - $TOOL"
  done
  echo ""
  echo "インストール方法："
  echo "  wrangler: npm install -g wrangler"
  echo "  jq: brew install jq (macOS) / apt-get install jq (Ubuntu)"
  echo "  auth0: brew install auth0/auth0-cli/auth0 (macOS) / curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh (Linux)"
  exit 1
fi

echo -e "${GREEN}✓ 必要なツールが揃っています${NC}"
echo ""

# Cloudflareセットアップ
echo "========================================="
echo "Step 1: Cloudflare セットアップ"
echo "========================================="
bash scripts/setup-cloudflare.sh

echo ""
echo "========================================="
echo "Step 2: Auth0 セットアップ"
echo "========================================="
bash scripts/setup-auth0.sh

echo ""
echo "========================================="
echo "✅ セットアップが完了しました！"
echo "========================================="
echo ""
echo "作成されたファイル："
echo "  - .cloudflare-config.json (Cloudflare設定)"
echo "  - .auth0-config.json (Auth0設定)"
echo "  - .env.local (環境変数)"
echo "  - .dev.vars (Wrangler開発用環境変数)"
echo ""
echo "次のステップ："
echo "1. wrangler.jsonc の database_id を .cloudflare-config.json の値で更新"
echo "2. マイグレーションファイルを作成（まだの場合）"
echo "3. 開発サーバーを起動："
echo -e "   ${YELLOW}npm run dev${NC}"
echo ""
echo "本番デプロイ前に Cloudflare Secrets をプッシュしてください："
echo -e "   ${YELLOW}npm run push:secrets${NC}"
