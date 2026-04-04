import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Browser } from '@capacitor/browser';
import { authApi } from '../services/api-client';
import { useAuthStore } from '../stores/auth-store';
import { isNativePlatform } from '../utils/capacitor';
import { buildLoginUrl } from '../services/auth0-native';

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

export function useAuth() {
  const queryClient = useQueryClient();
  const { setUser, setLoading, setInitialized } = useAuthStore();

  const meQuery = useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      const user = await authApi.getMe();
      setUser(user);
      setLoading(false);
      setInitialized(true);
      return user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const { logoutUrl } = await authApi.logout();
      return logoutUrl;
    },
    onSuccess: (logoutUrl) => {
      setUser(null);
      queryClient.clear();
      window.location.href = logoutUrl;
    },
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      if (isNativePlatform()) {
        // On mobile: build Auth0 PKCE URL directly and open in Chrome Custom Tab.
        // Auth0 redirects back via deep link (com.maronn.taskchute://) which is
        // handled by DeepLinkHandler → useDeepLink → exchangeCodeForToken.
        const loginUrl = await buildLoginUrl();
        await Browser.open({ url: loginUrl });
      } else {
        // On web: use server-side redirect flow
        window.location.href = authApi.getLoginUrl();
      }
    },
  });

  return {
    user: meQuery.data,
    isLoading: meQuery.isLoading,
    isAuthenticated: Boolean(meQuery.data),
    login: () => loginMutation.mutate(),
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
