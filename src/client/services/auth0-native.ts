import { Auth0Client } from '@auth0/auth0-spa-js';

interface Auth0Config {
  domain: string;
  clientId: string;
  audience: string;
}

let auth0Client: Auth0Client | null = null;
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

export async function getAuth0Client(): Promise<Auth0Client> {
  if (auth0Client) return auth0Client;

  const config = await getAuth0Config();

  auth0Client = new Auth0Client({
    domain: config.domain,
    clientId: config.clientId,
    authorizationParams: {
      redirect_uri: `com.maronn.taskchute://${config.domain}/capacitor/com.maronn.taskchute/callback`,
      audience: config.audience,
      scope: 'openid profile email',
    },
    useRefreshTokens: true,
    useRefreshTokensFallback: false,
  });

  return auth0Client;
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
