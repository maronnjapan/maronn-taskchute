import { Hono } from 'hono';
import { AuthService } from '../services/auth-service';
import { UserRepository } from '../repositories/user-repository';
import { SessionRepository } from '../repositories/session-repository';
import { generateId } from '../../shared/utils/index';

type Bindings = {
  DB: D1Database;
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  AUTH0_CALLBACK_URL: string;
};

type Variables = {
  user: import('../../shared/types/index').User | null;
  userId: string | null;
};

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function getAuthService(c: { env: Bindings }) {
  const userRepo = new UserRepository(c.env.DB);
  const sessionRepo = new SessionRepository(c.env.DB);
  return new AuthService(userRepo, sessionRepo, {
    domain: c.env.AUTH0_DOMAIN,
    clientId: c.env.AUTH0_CLIENT_ID,
    clientSecret: c.env.AUTH0_CLIENT_SECRET,
    callbackUrl: c.env.AUTH0_CALLBACK_URL,
  });
}

// GET /auth/login - Redirect to Auth0 login
auth.get('/login', (c) => {
  const authService = getAuthService(c);
  const state = generateId();

  // Store state in cookie for CSRF protection
  c.header('Set-Cookie', `auth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);

  const loginUrl = authService.getLoginUrl(state);
  return c.redirect(loginUrl);
});

// GET /auth/callback - Handle Auth0 callback
auth.get('/callback', async (c) => {
  const authService = getAuthService(c);

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  const errorDescription = c.req.query('error_description');

  // Check for Auth0 error
  if (error) {
    console.error('Auth0 error:', error, errorDescription);
    return c.redirect('/?error=auth_failed');
  }

  if (!code) {
    return c.redirect('/?error=no_code');
  }

  // Verify state (CSRF protection)
  const cookie = c.req.header('Cookie');
  const storedState = cookie?.match(/auth_state=([^;]+)/)?.[1];

  if (!storedState || storedState !== state) {
    return c.redirect('/?error=invalid_state');
  }

  try {
    const { session } = await authService.handleCallback(code);

    // Set session cookie
    authService.setSessionCookie(c, session.id);

    // Clear state cookie
    c.header('Set-Cookie', 'auth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0', {
      append: true,
    });

    return c.redirect('/');
  } catch (err) {
    console.error('Callback error:', err);
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
