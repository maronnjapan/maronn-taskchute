import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createWorkspaceSchema } from '../../../shared/validators/index';
import type { CreateWorkspaceInput } from '../../../shared/validators/index';
import type { Workspace } from '../../../shared/types/index';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type WorkspaceFormFields = z.infer<typeof createWorkspaceSchema>;

interface WorkspaceFormProps {
  workspace?: Workspace;
  onSubmit: (data: CreateWorkspaceInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function WorkspaceForm({ workspace, onSubmit, onCancel, isSubmitting = false }: WorkspaceFormProps) {
  const isEditing = !!workspace;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkspaceFormFields>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: workspace
      ? { name: workspace.name }
      : { name: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="ワークスペース名"
        {...register('name')}
        error={errors.name?.message}
        placeholder="マイワークスペース"
        autoFocus
      />

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          キャンセル
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {isEditing ? '更新' : '作成'}
        </Button>
      </div>
    </form>
  );
}
