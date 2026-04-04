import { generateCodeVerifier, generateCodeChallenge, generateId } from '../../shared/utils/index';

interface Auth0Config {
  domain: string;
  clientId: string;
  audience: string;
}

interface PkceState {
  codeVerifier: string;
  state: string;
  redirectUri: string;
}

const PKCE_STORAGE_KEY = 'auth0_mobile_pkce';
let configCache: Auth0Config | null = null;

export async function getAuth0Config(): Promise<Auth0Config> {
  if (configCache) return configCache;

  const response = await fetch('/auth/config', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch Auth0 config');
  }
  const result: { data: Auth0Config } = await response.json();
  configCache = result.data;
  return configCache;
}

/**
 * Build the Auth0 authorization URL for the mobile PKCE flow.
 * Stores the PKCE state (code_verifier + state) in localStorage so it
 * survives the app being backgrounded while the Custom Tab is open.
 */
export async function buildLoginUrl(): Promise<string> {
  const config = await getAuth0Config();

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateId();
  const redirectUri = `com.maronn.taskchute://${config.domain}/capacitor/com.maronn.taskchute/callback`;

  const pkceState: PkceState = { codeVerifier, state, redirectUri };
  sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(pkceState));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile email offline_access',
    audience: config.audience,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://${config.domain}/authorize?${params.toString()}`;
}

/**
 * Handle the Auth0 callback URL: validate state, exchange the authorization
 * code for an access token using PKCE, and return the access token.
 */
export async function exchangeCodeForToken(callbackUrl: string): Promise<string> {
  const config = await getAuth0Config();

  const parsedUrl = new URL(callbackUrl);
  const code = parsedUrl.searchParams.get('code');
  const state = parsedUrl.searchParams.get('state');
  const error = parsedUrl.searchParams.get('error');

  // Always clean up stored PKCE state
  const pkceStateJson = sessionStorage.getItem(PKCE_STORAGE_KEY);
  sessionStorage.removeItem(PKCE_STORAGE_KEY);

  if (error) {
    throw new Error(`Auth0 error: ${error}`);
  }

  if (!code || !state) {
    throw new Error('Missing code or state in callback URL');
  }

  if (!pkceStateJson) {
    throw new Error('No PKCE state found — login session may have expired');
  }

  const pkceState = JSON.parse(pkceStateJson) as PkceState;

  if (pkceState.state !== state) {
    throw new Error('State mismatch');
  }

  const tokenResponse = await fetch(`https://${config.domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      code,
      redirect_uri: pkceState.redirectUri,
      code_verifier: pkceState.codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${errorBody}`);
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };
  return tokenData.access_token;
}

export async function createServerSession(accessToken: string): Promise<void> {
  const response = await fetch('/auth/token-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ accessToken }),
  });
  if (!response.ok) {
    throw new Error('Failed to create server session');
  }
}
