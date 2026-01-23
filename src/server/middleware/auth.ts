import type { Context, Next } from 'hono';
import { AuthService } from '../services/auth-service';
import { UserRepository } from '../repositories/user-repository';
import { SessionRepository } from '../repositories/session-repository';
import type { User } from '../../shared/types/index';

interface AuthEnv {
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  AUTH0_CALLBACK_URL: string;
  AUTH0_AUDIENCE: string;
}

// Extend Hono's context to include user
declare module 'hono' {
  interface ContextVariableMap {
    user: User | null;
    userId: string | null;
  }
}

export function createAuthMiddleware(db: D1Database) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (c: Context<any, any, any>, next: Next) => {
    const env = c.env as AuthEnv;
    const userRepo = new UserRepository(db);
    const sessionRepo = new SessionRepository(db);
    const authService = new AuthService(userRepo, sessionRepo, {
      domain: env.AUTH0_DOMAIN,
      clientId: env.AUTH0_CLIENT_ID,
      clientSecret: env.AUTH0_CLIENT_SECRET,
      callbackUrl: env.AUTH0_CALLBACK_URL,
      audience: env.AUTH0_AUDIENCE,
    });

    const sessionId = authService.getSessionIdFromCookie(c);

    if (sessionId) {
      const result = await authService.validateSession(sessionId);
      if (result) {
        c.set('user', result.user);
        c.set('userId', result.user.id);
      } else {
        c.set('user', null);
        c.set('userId', null);
      }
    } else {
      c.set('user', null);
      c.set('userId', null);
    }

    await next();
  };
}

export function requireAuth() {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user) {
      return c.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        401
      );
    }
    await next();
  };
}
