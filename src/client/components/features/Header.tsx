import { useAuth } from '../../hooks/use-auth';
import { Button } from '../ui/Button';

export function Header() {
  const { user, isAuthenticated, isLoading, login, logout, isLoggingOut } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">TaskChute</h1>
          </div>

          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
            ) : isAuthenticated ? (
              <>
                <span className="text-sm text-gray-600">{user?.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logout()}
                  isLoading={isLoggingOut}
                >
                  ログアウト
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={login}>
                ログイン
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
