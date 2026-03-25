import { useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { isNativePlatform } from '../utils/capacitor';
import { getAuth0Client, createServerSession } from '../services/auth0-native';
import { authKeys } from './use-auth';

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
  const listenerAdded = useRef(false);

  const callbackMutation = useMutation({
    mutationFn: handleAuth0Callback,
    onSuccess: () => {
      // Refresh auth state after server session is created
      void queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });

  const initDeepLinkListener = useCallback(() => {
    if (!isNativePlatform() || listenerAdded.current) return;
    listenerAdded.current = true;

    const capacitorApp = App as unknown as {
      addListener: (eventName: 'appUrlOpen', listenerFunc: (event: { url: string }) => void) => Promise<void>;
    };

    void capacitorApp.addListener('appUrlOpen', (event) => {
      // Auth0 callback URLs contain 'state' and either 'code' or 'error'
      if (event.url.includes('state') && (event.url.includes('code') || event.url.includes('error'))) {
        callbackMutation.mutate(event.url);
      }
    });
  }, [callbackMutation]);

  return { initDeepLinkListener };
}
