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
        alert('[DEBUG] Step 1: isNativePlatform = true');
        let loginUrl: string;
        try {
          loginUrl = await buildLoginUrl();
        } catch (e) {
          alert('[DEBUG] Step 2 FAILED (buildLoginUrl): ' + String(e));
          throw e;
        }
        alert('[DEBUG] Step 2 OK: URL先頭=' + loginUrl.slice(0, 60));
        try {
          await Browser.open({ url: loginUrl });
        } catch (e) {
          alert('[DEBUG] Step 3 FAILED (Browser.open): ' + String(e));
          throw e;
        }
        alert('[DEBUG] Step 3 OK: Browser.open完了');
      } else {
        alert('[DEBUG] isNativePlatform = false → web フロー');
        window.location.href = authApi.getLoginUrl();
      }
    },
    onError: (e) => {
      alert('[DEBUG] loginMutation onError: ' + String(e));
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
