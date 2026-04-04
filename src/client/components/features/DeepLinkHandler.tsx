import { useDeepLink } from '../../hooks/use-deep-link';

export function DeepLinkHandler() {
  const { callbackError } = useDeepLink();

  if (!callbackError) return null;

  const message = callbackError instanceof Error ? callbackError.message : String(callbackError);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-100 border-b border-red-400 px-4 py-3 text-sm text-red-800">
      ログインコールバックエラー: {message}
    </div>
  );
}
