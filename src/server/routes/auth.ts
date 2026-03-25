import { Hono } from 'hono';
import { AuthService } from '../services/auth-service';
import { UserRepository } from '../repositories/user-repository';
import { SessionRepository } from '../repositories/session-repository';
import { AuthCodeRepository } from '../repositories/auth-code-repository';
import { generateId, generateCodeVerifier, generateCodeChallenge } from '../../shared/utils/index';
import type { User } from '../../shared/types/index';

interface Bindings {
  DB: D1Database;
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  AUTH0_CALLBACK_URL: string;
  AUTH0_AUDIENCE: string;
}

interface Variables {
  user: User | null;
  userId: string | null;
}

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function getAuthService(c: { env: Bindings }) {
  const userRepo = new UserRepository(c.env.DB);
  const sessionRepo = new SessionRepository(c.env.DB);
  return new AuthService(userRepo, sessionRepo, {
    domain: c.env.AUTH0_DOMAIN,
    clientId: c.env.AUTH0_CLIENT_ID,
    clientSecret: c.env.AUTH0_CLIENT_SECRET,
    callbackUrl: c.env.AUTH0_CALLBACK_URL,
    audience: c.env.AUTH0_AUDIENCE,
  });
}

function getAuthCodeRepo(c: { env: Bindings }) {
  return new AuthCodeRepository(c.env.DB);
}

// GET /auth/login - Redirect to Auth0 login
auth.get('/login', async (c) => {
  const authService = getAuthService(c);
  const state = generateId();

  // Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Detect mobile platform (passed as query param from Capacitor app)
  const platform = c.req.query('platform') ?? '';

  // Store state, code_verifier, and platform in cookies for CSRF protection and PKCE
  c.header('Set-Cookie', `auth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  c.header('Set-Cookie', `code_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`, {
    append: true,
  });
  c.header('Set-Cookie', `auth_platform=${platform === 'mobile' ? 'mobile' : ''}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`, {
    append: true,
  });

  const loginUrl = authService.getLoginUrl(state, codeChallenge);
  return c.redirect(loginUrl);
});

// GET /auth/callback - Handle Auth0 callback
auth.get('/callback', async (c) => {
  const authService = getAuthService(c);
  const cookie = c.req.header('Cookie');
  const authPlatform = cookie ? /auth_platform=([^;]+)/.exec(cookie)?.[1] : undefined;

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  const errorDescription = c.req.query('error_description');

  // Check for Auth0 error
  if (error) {
    console.error('Auth0 error:', error, errorDescription);
    if (authPlatform === 'mobile') {
      return c.redirect(`com.maronn.taskchute://callback?error=${encodeURIComponent(error)}`);
    }
    return c.redirect('/?error=auth_failed');
  }

  if (!code) {
    if (authPlatform === 'mobile') {
      return c.redirect('com.maronn.taskchute://callback?error=no_code');
    }
    return c.redirect('/?error=no_code');
  }

  // Verify state (CSRF protection)
  const storedState = cookie?.match(/auth_state=([^;]+)/)?.[1];
  const codeVerifier = cookie?.match(/code_verifier=([^;]+)/)?.[1];

  if (!storedState || storedState !== state) {
    if (authPlatform === 'mobile') {
      return c.redirect('com.maronn.taskchute://callback?error=invalid_state');
    }
    return c.redirect('/?error=invalid_state');
  }

  if (!codeVerifier) {
    if (authPlatform === 'mobile') {
      return c.redirect('com.maronn.taskchute://callback?error=missing_code_verifier');
    }
    return c.redirect('/?error=missing_code_verifier');
  }

  try {
    const { session } = await authService.handleCallback(code, codeVerifier);

    // Set session cookie
    authService.setSessionCookie(c, session.id);

    // Clear state, code_verifier, and platform cookies
    c.header('Set-Cookie', 'auth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0', {
      append: true,
    });
    c.header('Set-Cookie', 'code_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0', {
      append: true,
    });
    c.header('Set-Cookie', 'auth_platform=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0', {
      append: true,
    });

    if (authPlatform === 'mobile') {
      // For mobile: generate a one-time auth code and redirect to the app via deep link
      const authCodeRepo = getAuthCodeRepo(c);
      const authCode = await authCodeRepo.create(session.id, generateId());
      return c.redirect(`com.maronn.taskchute://callback?code=${authCode.code}&verifier=${authCode.verifier}`);
    }

    return c.redirect('/');
  } catch (err) {
    console.error('Callback error:', err);
    if (authPlatform === 'mobile') {
      return c.redirect('com.maronn.taskchute://callback?error=callback_failed');
    }
    return c.redirect('/?error=callback_failed');
  }
});

// POST /auth/logout - Logout user
auth.post('/logout', async (c) => {
  const authService = getAuthService(c);
  const sessionId = authService.getSessionIdFromCookie(c);

  if (sessionId) {
    await authService.logout(sessionId);
  }

  authService.clearSessionCookie(c);

  // Get return URL from request or default to home
  const returnTo = new URL(c.req.url).origin;
  const logoutUrl = authService.getLogoutUrl(returnTo);

  return c.json({ logoutUrl });
});

// POST /auth/exchange - Exchange a one-time auth code for a session cookie (mobile flow)
auth.post('/exchange', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null);
  const code = typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string' ? body.code.trim() : '';
  const verifier =
    typeof body === 'object' && body !== null && 'verifier' in body && typeof body.verifier === 'string'
      ? body.verifier.trim()
      : '';

  if (!code) {
    return c.json({ error: { code: 'missing_code', message: 'Auth code is required' } }, 400);
  }
  if (!verifier) {
    return c.json({ error: { code: 'missing_verifier', message: 'Auth code verifier is required' } }, 400);
  }

  const authCodeRepo = getAuthCodeRepo(c);
  const sessionId = await authCodeRepo.exchange(code, verifier);

  if (!sessionId) {
    return c.json({ error: { code: 'invalid_code', message: 'Auth code is invalid or expired' } }, 401);
  }

  const authService = getAuthService(c);
  authService.setSessionCookie(c, sessionId);

  return c.json({ data: { success: true } });
});

// GET /auth/me - Get current user info
auth.get('/me', (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ data: null });
  }

  const authService = getAuthService(c);
  return c.json({ data: authService.toAuthUser(user) });
});

export default auth;
