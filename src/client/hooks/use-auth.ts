import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../services/api-client';
import { useAuthStore } from '../stores/auth-store';

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

  return {
    user: meQuery.data,
    isLoading: meQuery.isLoading,
    isAuthenticated: Boolean(meQuery.data),
    login: () => {
      window.location.href = authApi.getLoginUrl();
    },
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
