import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';

/**
 * ヘルスチェックエンドポイントのテスト
 */
describe('Health Check API', () => {
  const app = new Hono();

  // ヘルスチェックエンドポイント
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  it('GET /health はステータス200を返す', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });

  it('GET /health は正しいJSONを返す', async () => {
    const res = await app.request('/health');
    const data = await res.json();

    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('version');
  });

  it('GET /health のタイムスタンプはISO 8601形式', async () => {
    const res = await app.request('/health');
    const data = await res.json() as { status: string; timestamp: string; version: string };

    const timestamp = data.timestamp;
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(() => new Date(timestamp)).not.toThrow();
  });
});
