import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createTaskSchema, repeatPatternSchema } from '../../../shared/validators/index';
import type { CreateTaskInput, UpdateTaskInput } from '../../../shared/validators/index';
import type { Task, RepeatPattern } from '../../../shared/types/index';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { getTodayString } from '../../../shared/utils/index';

// Extended form schema with repeat pattern
const taskFormSchema = createTaskSchema.extend({
  repeatPattern: repeatPatternSchema.nullable().optional(),
});

type TaskFormFields = z.infer<typeof taskFormSchema>;

const repeatPatternOptions: { value: RepeatPattern | ''; label: string }[] = [
  { value: '', label: '繰り返しなし' },
  { value: 'daily', label: '毎日' },
  { value: 'weekdays', label: '平日のみ' },
  { value: 'weekly', label: '毎週' },
  { value: 'monthly', label: '毎月' },
];

interface TaskFormProps {
  task?: Task;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  defaultDate?: string;
  defaultEstimatedMinutes?: number;
}

export function TaskForm({
  task,
  onSubmit,
  onCancel,
  isSubmitting = false,
  defaultDate,
  defaultEstimatedMinutes,
}: TaskFormProps) {
  const isEditing = Boolean(task);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<TaskFormFields>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: task
      ? {
          title: task.title,
          description: task.description ?? '',
          scheduledDate: task.scheduledDate,
          estimatedMinutes: task.estimatedMinutes,
          repeatPattern: task.repeatPattern ?? null,
        }
      : {
          title: '',
          description: '',
          scheduledDate: defaultDate ?? getTodayString(),
          estimatedMinutes: defaultEstimatedMinutes,
          repeatPattern: null,
        },
  });

  const selectedRepeatPattern = watch('repeatPattern');

  const handleFormSubmit = (data: TaskFormFields) => {
    const cleanData: CreateTaskInput | UpdateTaskInput = {
      ...data,
      description: data.description === '' ? undefined : data.description,
      estimatedMinutes: data.estimatedMinutes === 0 ? undefined : data.estimatedMinutes,
      repeatPattern: data.repeatPattern || undefined,
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          繰り返し設定
        </label>
        <select
          {...register('repeatPattern')}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                     focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          {repeatPatternOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {selectedRepeatPattern && (
          <p className="mt-1 text-xs text-gray-500">
            この設定により、タスクは{repeatPatternOptions.find(o => o.value === selectedRepeatPattern)?.label}反映されます。
          </p>
        )}
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
