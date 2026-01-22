import { hc } from 'hono/client';
import type { AppType } from '../../server';

// 開発環境と本番環境でベースURLを切り替え
console.log(import.meta.env.DEV);
const baseUrl = import.meta.env.DEV
  ? 'http://localhost:8787/api'  // 開発環境: Wranglerサーバー
  : '/api';                       // 本番環境: 同一オリジン

// Hono RPCクライアントを作成
export const client = hc<AppType>('/api');
