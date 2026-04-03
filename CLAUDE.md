# TaskChute Web App - CLAUDE.md

## プロジェクト概要

タスクシュート方式の時間記録・管理ができるWebアプリケーション。
高速な表示とオフライン対応を重視し、ネットワーク状況に依存しない操作性を実現する。

## ツール役割分担

| ツール | 担当 |
|---|---|
| Claude Code | 全フェーズの進行・最終判断 |
| Codex CLI | 設計協議・コードレビュー（セカンドオピニオン） |
| Gemini CLI | 技術仕様調査・外部ドキュメント調査 |

## 開発ワークフロー

機能追加・修正の依頼を受けたとき、以下のフェーズ通りに原則実行する。
基本的にフェーズを順番通りに実行することを求めるが、依頼内容が軽微であり調査や設計が不要だと感じれば省略してもよい。
ただし、省略した場合は必ず省略したフェーズと省略した理由をユーザーに提示すること。
ユーザーへの確認は⑦の完了レポートまで行わない。

### ① 調査フェーズ
- 関連する既存コードをすべて読む
- Reactの制約・Honoのルーティング・D1のスキーマを確認する
- 技術的に不明な仕様があれば `/tech-research` スキルでGeminiに調査させる

### ② 設計フェーズ（Claude起案）
- 実装方針のドラフトを作る
- ファイル構成・関数の責務・データの流れを箇条書きで言語化する

### ③ 設計協議フェーズ（Claude × Codex）
- `/design-discussion` スキルを使ってCodexに設計ドラフトを渡す
- Codexの意見をもとにClaudeが設計を再評価する
- 合意できた方針を「確定設計」として記録してから実装に進む

### ④ テスト先行実装フェーズ
- テストを先に書いてから実装する（TDD / Red → Green → Refactor）
- モックは原則使わない
- テストが通ることを確認してから次に進む
- テストが3回修正しても通らなければ実装を止め、⑦で報告する

### ⑤ コードレビュー（Claude × Codex）
- `/design-discussion` スキルを使ってCodexに実装済みコードを渡す
- Codexの指摘をClaudeが評価し、修正する箇所・しない箇所を判断する
- 修正がある場合はテストを再実行して通ることを確認する

### ⑥ セルフレビューフェーズ
- 設計との整合・可読性・エラーハンドリングを最終確認する

### ⑦ 完了レポート

```
## 実装内容
（何を実装したか、1〜3行で）

## 変更ファイル
- path/to/file.ts: （変更内容）
- path/to/test.ts: （テスト内容）

## テスト結果
（通過したテスト数）

## 省略したフェーズ（省略がない場合も「なし」と明記すること）
- フェーズ名: 省略した理由
  例) ① /tech-research: 既存コードに仕様が実装済みのため調査不要と判断

## 設計協議の結果
- Codexの主な意見: （要約）
- 採用した意見: （内容）
- 採用しなかった意見: （内容と理由）

## 判断が必要な点（あれば）
（AIだけでは解決できなかった点）
```

## AIだけでは解決しないこと

以下の状況になったら実装を止めて⑦に記載する:
- 挙動が不明で調査しても解決しない
- D1のスキーマ変更がデータ移行を伴う
- 認証まわりの設計判断が必要
- テストが3回修正しても通らない


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
