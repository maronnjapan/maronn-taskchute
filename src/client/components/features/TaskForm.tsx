import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { createTaskSchema } from '../../../shared/validators/index';
import type { CreateTaskInput, UpdateTaskInput } from '../../../shared/validators/index';
import type { Task } from '../../../shared/types/index';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { getTodayString } from '../../../shared/utils/index';

// Form fields type (subset of CreateTaskInput)
type TaskFormFields = z.infer<typeof createTaskSchema>;

interface TaskFormProps {
  task?: Task;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  defaultDate?: string;
}

export function TaskForm({ task, onSubmit, onCancel, isSubmitting = false, defaultDate }: TaskFormProps) {
  const isEditing = Boolean(task);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TaskFormFields>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: task
      ? {
          title: task.title,
          description: task.description ?? '',
          scheduledDate: task.scheduledDate,
          estimatedMinutes: task.estimatedMinutes,
        }
      : {
          title: '',
          description: '',
          scheduledDate: defaultDate ?? getTodayString(),
          estimatedMinutes: undefined,
        },
  });

  const handleFormSubmit = (data: TaskFormFields) => {
    const cleanData = {
      ...data,
      description: data.description === '' ? undefined : data.description,
      estimatedMinutes: data.estimatedMinutes === 0 ? undefined : data.estimatedMinutes,
    };
    onSubmit(cleanData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Input
        label="タイトル"
        {...register('title')}
        error={errors.title?.message}
        placeholder="タスクのタイトルを入力"
        autoFocus
      />

      <TextArea
        label="説明"
        {...register('description')}
        error={errors.description?.message}
        placeholder="タスクの説明（任意）"
        rows={3}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="予定日"
          type="date"
          {...register('scheduledDate')}
          error={errors.scheduledDate?.message}
        />

        <Input
          label="見積時間（分）"
          type="number"
          {...register('estimatedMinutes', { valueAsNumber: true })}
          error={errors.estimatedMinutes?.message}
          placeholder="30"
          min={0}
          max={1440}
        />
      </div>

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
