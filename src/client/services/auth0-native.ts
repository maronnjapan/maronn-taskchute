import { generateCodeVerifier, generateCodeChallenge, generateId } from '../../shared/utils/index';
import { isNativePlatform } from '../utils/capacitor';

interface Auth0Config {
  domain: string;
  clientId: string;
  audience: string;
}

interface PkceState {
  codeVerifier: string;
  state: string;
  redirectUri: string;
  expiresAt: number;
}

const PKCE_STORAGE_KEY = 'auth0_mobile_pkce';
const PKCE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let configCache: Auth0Config | null = null;

/**
 * Secure storage abstraction for PKCE state.
 * - Native (iOS/Android): Keychain / Keystore via capacitor-secure-storage-plugin
 * - Web: localStorage (PKCE state is temporary; web uses a different auth flow)
 */
const pkceStorage = {
  async set(value: string): Promise<void> {
    if (isNativePlatform()) {
      const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
      await SecureStoragePlugin.set({ key: PKCE_STORAGE_KEY, value });
    } else {
      localStorage.setItem(PKCE_STORAGE_KEY, value);
    }
  },

  async get(): Promise<string | null> {
    if (isNativePlatform()) {
      try {
        const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
        const result = await SecureStoragePlugin.get({ key: PKCE_STORAGE_KEY });
        return result.value;
      } catch {
        // SecureStoragePlugin.get throws when key is not found
        return null;
      }
    } else {
      return localStorage.getItem(PKCE_STORAGE_KEY);
    }
  },

  async remove(): Promise<void> {
    if (isNativePlatform()) {
      try {
        const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
        await SecureStoragePlugin.remove({ key: PKCE_STORAGE_KEY });
      } catch {
        // ignore — key may already be absent
      }
    } else {
      localStorage.removeItem(PKCE_STORAGE_KEY);
    }
  },
};

export async function getAuth0Config(): Promise<Auth0Config> {
  if (configCache) return configCache;

  // Prefer build-time env vars so the mobile APK works without server connectivity.
  // VITE_AUTH0_* are public values (domain, clientId, audience) — safe to bundle.
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_NATIVE_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  if (domain && clientId && audience) {
    configCache = { domain, clientId, audience };
    return configCache;
  }

  // Fall back to server fetch (e.g. local dev without env vars set)
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
 * Stores the PKCE state (code_verifier + state) in iOS Keychain / Android Keystore
 * so it survives the WebView process being killed while the Custom Tab is open.
 */
export async function buildLoginUrl(): Promise<string> {
  const config = await getAuth0Config();

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateId();
  const redirectUri = `com.maronn.taskchute://${config.domain}/capacitor/com.maronn.taskchute/callback`;

  // Clear any stale PKCE state from a previously abandoned login attempt
  await pkceStorage.remove();

  const pkceState: PkceState = {
    codeVerifier,
    state,
    redirectUri,
    expiresAt: Date.now() + PKCE_TTL_MS,
  };
  await pkceStorage.set(JSON.stringify(pkceState));

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
  const pkceStateJson = await pkceStorage.get();
  await pkceStorage.remove();

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

  if (Date.now() > pkceState.expiresAt) {
    throw new Error('PKCE state expired — please try logging in again');
  }

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
