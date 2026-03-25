import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Browser } from '@capacitor/browser';
import { authApi } from '../services/api-client';
import { useAuthStore } from '../stores/auth-store';
import { isNativePlatform } from '../utils/capacitor';

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

  const login = async () => {
    if (isNativePlatform()) {
      // On native: open login in system browser with mobile flag
      // After Auth0 callback, server redirects to deep link → app handles it
      const loginUrl = `${window.location.origin}/auth/login?platform=mobile`;
      await Browser.open({ url: loginUrl });
    } else {
      window.location.href = authApi.getLoginUrl();
    }
  };

  return {
    user: meQuery.data,
    isLoading: meQuery.isLoading,
    isAuthenticated: Boolean(meQuery.data),
    login,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
