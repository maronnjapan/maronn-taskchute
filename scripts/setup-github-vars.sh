#!/bin/bash
# GitHub Actions repository variables を .env.local から設定するスクリプト
# 使用方法: pnpm run setup:github-vars
#
# 前提条件:
#   - GitHub CLI (gh) がインストール済みであること
#   - gh auth login でログイン済みであること
#   - リポジトリの Settings > Variables を変更できる権限があること

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# .env.local が存在するか確認
if [ ! -f ".env.local" ]; then
  echo -e "${RED}Error: .env.local ファイルが見つかりません${NC}"
  echo "先に Auth0 のセットアップを実行してください:"
  echo "  pnpm run setup:auth0"
  exit 1
fi

# gh CLI が使えるか確認
if ! command -v gh &> /dev/null; then
  echo -e "${RED}Error: GitHub CLI (gh) がインストールされていません${NC}"
  echo "インストール: https://cli.github.com/"
  exit 1
fi

# gh のログイン状態を確認
if ! gh auth status &> /dev/null; then
  echo -e "${RED}Error: GitHub CLI にログインしていません${NC}"
  echo "実行してください: gh auth login"
  exit 1
fi

# .env.local から環境変数を読み込み
set -a
source .env.local
set +a

# 必須変数のチェック
REQUIRED_VARS=("AUTH0_DOMAIN" "AUTH0_CLIENT_ID" "AUTH0_AUDIENCE")
for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    echo -e "${RED}Error: $VAR が .env.local に設定されていません${NC}"
    exit 1
  fi
done

# リポジトリを取得
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
if [ -z "$REPO" ]; then
  echo -e "${RED}Error: GitHub リポジトリが取得できませんでした${NC}"
  echo "git リモートが設定されているか確認してくだ���い"
  exit 1
fi

echo "対象リポジトリ: ${YELLOW}$REPO${NC}"
echo ""
echo "以下の GitHub Actions Variables を設定します（公開値・Secrets ではありません）:"
echo -e "  VITE_AUTH0_DOMAIN:    ${YELLOW}$AUTH0_DOMAIN${NC}"
echo -e "  VITE_AUTH0_CLIENT_ID: ${YELLOW}$AUTH0_CLIENT_ID${NC}"
echo -e "  VITE_AUTH0_AUDIENCE:  ${YELLOW}$AUTH0_AUDIENCE${NC}"
echo ""
echo "続行しますか？ (y/N)"
read -r CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "キャンセルしました"
  exit 0
fi

echo ""
echo "設定中..."

gh variable set VITE_AUTH0_DOMAIN    --body "$AUTH0_DOMAIN"    --repo "$REPO"
echo -e "  ${GREEN}✅ VITE_AUTH0_DOMAIN${NC}"

gh variable set VITE_AUTH0_CLIENT_ID --body "$AUTH0_CLIENT_ID" --repo "$REPO"
echo -e "  ${GREEN}✅ VITE_AUTH0_CLIENT_ID${NC}"

gh variable set VITE_AUTH0_AUDIENCE  --body "$AUTH0_AUDIENCE"  --repo "$REPO"
echo -e "  ${GREEN}✅ VITE_AUTH0_AUDIENCE${NC}"

echo ""
echo -e "${GREEN}✅ GitHub Actions Variables の設定が完了しました${NC}"
echo ""
echo "次のステップ:"
echo "  - CAPACITOR_SERVER_URL が未設定の場合は別途設定してください:"
echo "    gh variable set CAPACITOR_SERVER_URL --body \"https://your-workers.dev\""
echo "  - android-build.yml を push してビルドを確認してください"
