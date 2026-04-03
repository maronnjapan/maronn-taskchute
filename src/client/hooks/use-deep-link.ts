import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { isNativePlatform } from '../utils/capacitor';
import { getAuth0Client, createServerSession } from '../services/auth0-native';
import { authKeys } from './use-auth';

// Module-level flag: persists across component remounts (e.g. React Strict Mode
// intentional unmount/remount in development), ensuring the listener is registered only once.
let listenerAdded = false;

function isAuth0CallbackUrl(url: string): boolean {
  return url.includes('state') && (url.includes('code') || url.includes('error'));
}

async function handleAuth0Callback(url: string): Promise<void> {
  const client = await getAuth0Client();

  // Let Auth0 SDK handle the callback (exchanges code for tokens via PKCE).
  // Close the Custom Tab even when callback handling throws (e.g. canceled/denied login).
  try {
    await client.handleRedirectCallback(url);
  } finally {
    await Browser.close();
  }

  // Get the access token and create a server session
  const accessToken = await client.getTokenSilently();
  await createServerSession(accessToken);
}

export function useDeepLink() {
  const queryClient = useQueryClient();

  const callbackMutation = useMutation({
    mutationFn: handleAuth0Callback,
    onSuccess: () => {
      // Refresh auth state after server session is created
      void queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });

  async function initDeepLinkListener() {
    if (!isNativePlatform() || listenerAdded) return;
    listenerAdded = true;

    // Cold-start: handle the case where the OS relaunched the app via a deep link
    const launchUrl = await App.getLaunchUrl();
    if (launchUrl?.url && isAuth0CallbackUrl(launchUrl.url)) {
      callbackMutation.mutate(launchUrl.url);
    }

    void App.addListener('appUrlOpen', (event: { url: string }) => {
      if (isAuth0CallbackUrl(event.url)) {
        callbackMutation.mutate(event.url);
      }
    });
  }

  return { initDeepLinkListener };
}
