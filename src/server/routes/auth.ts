import { Hono } from 'hono';
import { AuthService } from '../services/auth-service';
import { UserRepository } from '../repositories/user-repository';
import { SessionRepository } from '../repositories/session-repository';
import { generateId, generateCodeVerifier, generateCodeChallenge } from '../../shared/utils/index';
import type { User } from '../../shared/types/index';

interface Bindings {
  DB: D1Database;
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  AUTH0_CALLBACK_URL: string;
  AUTH0_AUDIENCE: string;
  AUTH0_NATIVE_CLIENT_ID: string;
}

interface Variables {
  user: User | null;
  userId: string | null;
}

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

interface JwtPayload {
  iss?: unknown;
  aud?: unknown;
  azp?: unknown;
  client_id?: unknown;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) return null;

  const payloadPart = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
  const paddedPayload = payloadPart.padEnd(Math.ceil(payloadPart.length / 4) * 4, '=');

  try {
    const decodedPayload = atob(paddedPayload);
    return JSON.parse(decodedPayload) as JwtPayload;
  } catch {
    return null;
  }
}

function isTokenBoundToApp(payload: JwtPayload, env: Bindings): boolean {
  const expectedIssuer = `https://${env.AUTH0_DOMAIN}/`;
  const { iss, aud, azp, client_id: clientIdClaim } = payload;

  if (iss !== expectedIssuer) {
    return false;
  }

  const audienceIncludesApi =
    (typeof aud === 'string' && aud === env.AUTH0_AUDIENCE) ||
    (Array.isArray(aud) && aud.includes(env.AUTH0_AUDIENCE));

  if (!audienceIncludesApi) {
    return false;
  }

  // Auth0 can encode the client binding as `azp` or `client_id` (RFC 9068 profile).
  // Accept either claim and enforce that it matches the web app or native app's Auth0 client ID.
  const boundClientId =
    typeof azp === 'string' ? azp : typeof clientIdClaim === 'string' ? clientIdClaim : null;

  return boundClientId === env.AUTH0_CLIENT_ID || boundClientId === env.AUTH0_NATIVE_CLIENT_ID;
}

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

// GET /auth/config - Return public Auth0 config for mobile SDK initialization
// Returns the Native App client ID (PKCE, no client secret) for use in the mobile app.
auth.get('/config', (c) => {
  return c.json({
    data: {
      domain: c.env.AUTH0_DOMAIN,
      clientId: c.env.AUTH0_NATIVE_CLIENT_ID,
      audience: c.env.AUTH0_AUDIENCE,
    },
  });
});

// GET /auth/login - Redirect to Auth0 login (web flow)
auth.get('/login', async (c) => {
  const authService = getAuthService(c);
  const state = generateId();

  // Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store state and code_verifier in cookies for CSRF protection and PKCE
  c.header('Set-Cookie', `auth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  c.header('Set-Cookie', `code_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`, {
    append: true,
  });

  const loginUrl = authService.getLoginUrl(state, codeChallenge);
  return c.redirect(loginUrl);
});

// GET /auth/callback - Handle Auth0 callback (web flow)
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
  const codeVerifier = cookie?.match(/code_verifier=([^;]+)/)?.[1];

  if (!storedState || storedState !== state) {
    return c.redirect('/?error=invalid_state');
  }

  if (!codeVerifier) {
    return c.redirect('/?error=missing_code_verifier');
  }

  try {
    const { session } = await authService.handleCallback(code, codeVerifier);

    // Set session cookie
    authService.setSessionCookie(c, session.id);

    // Clear state and code_verifier cookies
    c.header('Set-Cookie', 'auth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0', {
      append: true,
    });
    c.header('Set-Cookie', 'code_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0', {
      append: true,
    });

    return c.redirect('/');
  } catch (err) {
    console.error('Callback error:', err);
    return c.redirect('/?error=callback_failed');
  }
});

// POST /auth/token-login - Create server session from Auth0 access token (mobile flow)
// After the mobile app authenticates via Auth0 SDK, it sends the access token here
// to establish a server-side session cookie.
auth.post('/token-login', async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body: Record<string, unknown> = await c.req.json().catch(() => ({}));
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';

  if (!accessToken) {
    return c.json({ error: { code: 'missing_token', message: 'Access token is required' } }, 400);
  }

  try {
    const tokenPayload = decodeJwtPayload(accessToken);
    if (!tokenPayload) {
      return c.json({ error: { code: 'invalid_token', message: 'Access token is malformed' } }, 401);
    }

    if (!isTokenBoundToApp(tokenPayload, c.env)) {
      return c.json({ error: { code: 'invalid_token', message: 'Access token is not valid for this application' } }, 401);
    }

    // Validate token by fetching user info from Auth0
    const userInfoResponse = await fetch(`https://${c.env.AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoResponse.ok) {
      return c.json({ error: { code: 'invalid_token', message: 'Access token is invalid' } }, 401);
    }

    const userInfo: { sub: string; email: string; name: string } = await userInfoResponse.json();

    // Upsert user and create session
    const userRepo = new UserRepository(c.env.DB);
    const sessionRepo = new SessionRepository(c.env.DB);
    const user = await userRepo.upsertFromAuth0(userInfo.sub, userInfo.email, userInfo.name);
    const session = await sessionRepo.create(user.id);

    // Set session cookie
    const authService = getAuthService(c);
    authService.setSessionCookie(c, session.id);

    return c.json({ data: { success: true } });
  } catch (err) {
    console.error('Token login error:', err);
    return c.json({ error: { code: 'token_login_failed', message: 'Failed to create session' } }, 500);
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
