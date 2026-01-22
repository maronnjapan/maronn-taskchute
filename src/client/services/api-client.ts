import { hc } from 'hono/client';
import type { AppType } from '../../server';

// Hono RPCクライアントを作成
export const client = hc<AppType>('/api');
