import { useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { isNativePlatform } from '../utils/capacitor';
import { exchangeCodeForToken, createServerSession } from '../services/auth0-native';
import { authKeys } from './use-auth';

// Module-level URL store: Capacitor listener pushes URLs here,
// useSyncExternalStore reads from here (outside React render).
let pendingUrl: string | null = null;
const urlStoreListeners = new Set<() => void>();
let listenerAdded = false;

function notifyUrlStore() {
  urlStoreListeners.forEach((l) => l());
}

function isAuth0CallbackUrl(url: string): boolean {
  return url.includes('state') && (url.includes('code') || url.includes('error'));
}

async function handleAuth0Callback(url: string): Promise<void> {
  try {
    // Exchange the authorization code for an access token (PKCE flow).
    const accessToken = await exchangeCodeForToken(url);
    // Create a server-side session using the access token.
    await createServerSession(accessToken);
  } finally {
    // Close the Custom Tab regardless of success or failure.
    // Ignore errors (e.g., the Custom Tab may have already closed itself when
    // Android routed the custom-scheme deep link back to the app).
    await Browser.close().catch(() => {});
  }
}

// Stable module-level subscribe: registers the Capacitor listener in the
// subscribe callback, which runs after commit (outside render), making it safe.
function subscribeToDeepLinkUrl(onStoreChange: () => void) {
  urlStoreListeners.add(onStoreChange);

  if (!listenerAdded && isNativePlatform()) {
    listenerAdded = true;

    void (async () => {
      // Cold-start: handle the case where the OS relaunched the app via a deep link
      const launchUrl = await App.getLaunchUrl();
      if (launchUrl?.url && isAuth0CallbackUrl(launchUrl.url)) {
        pendingUrl = launchUrl.url;
        notifyUrlStore();
      }

      void App.addListener('appUrlOpen', (event: { url: string }) => {
        if (isAuth0CallbackUrl(event.url)) {
          pendingUrl = event.url;
          notifyUrlStore();
        }
      });
    })();
  }

  return () => {
    urlStoreListeners.delete(onStoreChange);
  };
}

function getUrlSnapshot() {
  return pendingUrl;
}

export function useDeepLink() {
  const queryClient = useQueryClient();

  // Subscribes to the module-level URL store. When Capacitor fires a deep link,
  // pendingUrl is set and React re-renders with the new URL.
  const url = useSyncExternalStore(subscribeToDeepLinkUrl, getUrlSnapshot, getUrlSnapshot);

  // Process the deep link URL via useQuery. Using useQuery (not useMutation) because
  // the URL serves as a stable query key that deduplicates processing automatically.
  const { error } = useQuery({
    queryKey: ['deep-link-callback', url],
    queryFn: async () => {
      if (!url) return null;

      await handleAuth0Callback(url);

      // Clear processed URL from the store
      pendingUrl = null;
      notifyUrlStore();

      // Refresh auth state after server session is created
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });

      return url;
    },
    enabled: url !== null,
    staleTime: Infinity,
    gcTime: 5_000,
    retry: false,
  });

  return { callbackError: error };
}
