import { useState, useCallback } from 'react';
import { Button } from '../ui/Button';
import type { Workspace } from '../../../shared/types/index';

interface ShareLinkDisplayProps {
  workspace: Workspace;
  onRegenerateToken?: () => void;
  isRegenerating?: boolean;
}

export function ShareLinkDisplay({
  workspace,
  onRegenerateToken,
  isRegenerating = false,
}: ShareLinkDisplayProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/s/${workspace.shareToken}`;

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [shareUrl]);

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-2">共有リンク</h3>
      <p className="text-xs text-gray-500 mb-3">
        このリンクを共有すると、ログインなしでタスクを閲覧・編集できます。
      </p>

      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={shareUrl}
          className="flex-1 text-sm bg-white border border-gray-300 rounded-md px-3 py-2 truncate"
        />
        <Button variant="secondary" size="sm" onClick={copyToClipboard}>
          {copied ? 'コピーしました!' : 'コピー'}
        </Button>
      </div>

      {onRegenerateToken && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerateToken}
            isLoading={isRegenerating}
          >
            トークンを再生成
          </Button>
          <p className="text-xs text-gray-500 mt-1">
            再生成すると、以前の共有リンクは無効になります。
          </p>
        </div>
      )}
    </div>
  );
}
