import { useWorkspaceStore } from '../../stores/workspace-store';
import type { Workspace } from '../../../shared/types/index';

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  onCreateNew?: () => void;
}

export function WorkspaceSelector({ workspaces, onCreateNew }: WorkspaceSelectorProps) {
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__new__') {
      onCreateNew?.();
    } else {
      setCurrentWorkspaceId(value);
    }
  };

  return (
    <div className="relative">
      <select
        value={currentWorkspaceId || ''}
        onChange={handleChange}
        className="
          block w-full pl-3 pr-10 py-2 text-base border-gray-300
          focus:outline-none focus:ring-blue-500 focus:border-blue-500
          sm:text-sm rounded-md bg-white
        "
      >
        {workspaces.length === 0 && !currentWorkspaceId && (
          <option value="" disabled>
            ワークスペースを選択...
          </option>
        )}
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
        {onCreateNew && (
          <option value="__new__">+ 新規ワークスペース作成</option>
        )}
      </select>
    </div>
  );
}
