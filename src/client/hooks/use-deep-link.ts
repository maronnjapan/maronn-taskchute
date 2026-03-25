import { useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from '@capacitor/app';
import { isNativePlatform } from '../utils/capacitor';
import { authKeys } from './use-auth';

async function setSessionCookie(sessionId: string): Promise<void> {
  const response = await fetch(`/auth/exchange?session=${encodeURIComponent(sessionId)}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to set session');
  }
}

export function useDeepLink() {
  const queryClient = useQueryClient();
  const listenerAdded = useRef(false);

  const exchangeMutation = useMutation({
    mutationFn: setSessionCookie,
    onSuccess: () => {
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
        const sessionId = url.searchParams.get('session');
        const error = url.searchParams.get('error');

        if (error) {
          console.error('Auth callback error:', error);
          return;
        }

        if (sessionId) {
          exchangeMutation.mutate(sessionId);
        }
      }
    });
  }, [exchangeMutation]);

  return { initDeepLinkListener };
}
