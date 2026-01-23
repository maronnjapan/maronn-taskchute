import type { Context } from 'hono';
import type { UserRepository } from '../repositories/user-repository';
import type { SessionRepository } from '../repositories/session-repository';
import type { User, Session, AuthUser } from '../../shared/types/index';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '../../shared/constants/index';

interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  audience: string;
}

interface Auth0TokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

interface Auth0UserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export class AuthService {
  constructor(
    private userRepo: UserRepository,
    private sessionRepo: SessionRepository,
    private config: Auth0Config
  ) {}

  getLoginUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      scope: 'openid profile email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      audience: this.config.audience,
    });

    return `https://${this.config.domain}/authorize?${params.toString()}`;
  }

  async handleCallback(code: string, codeVerifier: string): Promise<{ user: User; session: Session }> {
    // Exchange code for tokens with PKCE
    const tokenResponse = await fetch(`https://${this.config.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.callbackUrl,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    const tokens: Auth0TokenResponse = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch(`https://${this.config.domain}/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to get user info');
    }

    const userInfo: Auth0UserInfo = await userInfoResponse.json();

    // Upsert user
    const user = await this.userRepo.upsertFromAuth0(
      userInfo.sub,
      userInfo.email,
      userInfo.name
    );

    // Create session
    const session = await this.sessionRepo.create(user.id);

    return { user, session };
  }

  async validateSession(sessionId: string): Promise<{ user: User; session: Session } | null> {
    const session = await this.sessionRepo.findValidById(sessionId);
    if (!session) return null;

    const user = await this.userRepo.findById(session.userId);
    if (!user) {
      await this.sessionRepo.delete(sessionId);
      return null;
    }

    // Refresh session (sliding expiration)
    await this.sessionRepo.refresh(sessionId);

    return { user, session };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionRepo.delete(sessionId);
  }

  getLogoutUrl(returnTo: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      returnTo,
    });

    return `https://${this.config.domain}/v2/logout?${params.toString()}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSessionCookie(c: Context<any, any, any>, sessionId: string): void {
    c.header(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clearSessionCookie(c: Context<any, any, any>): void {
    c.header(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSessionIdFromCookie(c: Context<any, any, any>): string | undefined {
    const cookie = c.req.header('Cookie');
    if (!cookie) return undefined;

    const match = new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`).exec(cookie);
    return match?.[1];
  }

  toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}
