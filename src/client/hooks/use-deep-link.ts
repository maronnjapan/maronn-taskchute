import { useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from '@capacitor/app';
import { isNativePlatform } from '../utils/capacitor';
import { authKeys } from './use-auth';

async function exchangeAuthCode({
  code,
  verifier,
}: {
  code: string;
  verifier: string;
}): Promise<void> {
  const response = await fetch('/auth/exchange', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, verifier }),
  });
  if (!response.ok) {
    throw new Error('Failed to exchange auth code');
  }
}

export function useDeepLink() {
  const queryClient = useQueryClient();
  const listenerAdded = useRef(false);

  const exchangeMutation = useMutation({
    mutationFn: exchangeAuthCode,
    onSuccess: () => {
      // Refresh auth state after successful code exchange
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
      const url = new URL(event.url);

      if (url.host === 'callback') {
        const code = url.searchParams.get('code');
        const verifier = url.searchParams.get('verifier');
        const error = url.searchParams.get('error');

        if (error) {
          console.error('Auth callback error:', error);
          return;
        }

        if (code && verifier) {
          exchangeMutation.mutate({ code, verifier });
        }
      }
    });
  }, [exchangeMutation]);

  return { initDeepLinkListener };
}
