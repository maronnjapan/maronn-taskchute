import { Hono } from 'hono';
import { createAuthMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import auth from './routes/auth';
import workspaces from './routes/workspaces';
import share from './routes/share';
import comments from './routes/comments';
import type { User } from '../shared/types/index';

interface Bindings {
  DB: D1Database;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  ARCHIVE: R2Bucket;
  ENVIRONMENT?: string;
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  AUTH0_CALLBACK_URL: string;
}

interface Variables {
  user: User | null;
  userId: string | null;
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Global middleware
app.use('*', errorHandler());

// Auth middleware for all routes (sets user context)
app.use('*', async (c, next) => {
  if (c.env.DB) {
    const authMiddleware = createAuthMiddleware(c.env.DB);
    return authMiddleware(c, next);
  }
  // If DB is not available, set null user
  c.set('user', null);
  c.set('userId', null);
  await next();
});

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// Mount routes
app.route('/auth', auth);
app.route('/api/workspaces', workspaces);
app.route('/api/s', share);
app.route('/api', comments);

// Static asset serving and SPA fallback
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  const pathname = url.pathname;

  // Root path or paths without extension (SPA routes) return index.html
  if (pathname === '/' || (!pathname.includes('.') && !pathname.startsWith('/api') && !pathname.startsWith('/auth'))) {
    const indexRequest = new Request(new URL('/index.html', url.origin));
    const indexResponse = await c.env.ASSETS.fetch(indexRequest);

    // Create new Headers object (exclude location header)
    const newHeaders = new Headers();
    for (const [key, value] of indexResponse.headers.entries()) {
      if (key.toLowerCase() !== 'location') {
        newHeaders.set(key, value);
      }
    }
    newHeaders.set('Content-Type', 'text/html; charset=utf-8');

    return new Response(indexResponse.body, {
      status: 200,
      headers: newHeaders,
    });
  }

  // Serve static assets (JS, CSS, images, etc.)
  const assetRequest = new Request(new URL(pathname, url.origin));

  try {
    const response = await c.env.ASSETS.fetch(assetRequest);

    // Return index.html for 404 (SPA fallback)
    if (response.status === 404) {
      const indexRequest = new Request(new URL('/index.html', url.origin));
      const indexResponse = await c.env.ASSETS.fetch(indexRequest);

      const newHeaders = new Headers();
      for (const [key, value] of indexResponse.headers.entries()) {
        if (key.toLowerCase() !== 'location') {
          newHeaders.set(key, value);
        }
      }
      newHeaders.set('Content-Type', 'text/html; charset=utf-8');

      return new Response(indexResponse.body, {
        status: 200,
        headers: newHeaders,
      });
    }

    return response;
  } catch (error) {
    console.error('Asset fetch error:', error);
    // Return index.html on error
    const indexRequest = new Request(new URL('/index.html', url.origin));
    const indexResponse = await c.env.ASSETS.fetch(indexRequest);

    const newHeaders = new Headers();
    for (const [key, value] of indexResponse.headers.entries()) {
      if (key.toLowerCase() !== 'location') {
        newHeaders.set(key, value);
      }
    }
    newHeaders.set('Content-Type', 'text/html; charset=utf-8');

    return new Response(indexResponse.body, {
      status: 200,
      headers: newHeaders,
    });
  }
});

// Export types for RPC
export type AppType = typeof app;

export default app;
