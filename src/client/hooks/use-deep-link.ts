import { useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { isNativePlatform } from '../utils/capacitor';
import { authKeys } from './use-auth';

async function exchangeAuthCode(code: string): Promise<void> {
  const response = await fetch(`/auth/exchange?code=${encodeURIComponent(code)}`, {
    credentials: 'include',
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

    void App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      const url = new URL(event.url);

      if (url.host === 'callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          console.error('Auth callback error:', error);
          return;
        }

        if (code) {
          exchangeMutation.mutate(code);
        }
      }
    });
  }, [exchangeMutation]);

  return { initDeepLinkListener };
}
