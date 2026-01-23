import type { TaskStatus, RepeatPattern } from '../../../shared/types/index';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

const statusVariants: Record<TaskStatus, BadgeVariant> = {
  pending: 'default',
  in_progress: 'info',
};

const statusLabels: Record<TaskStatus, string> = {
  pending: '未着手',
  in_progress: '進行中',
};

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export function TaskStatusBadge({ status, className = '' }: TaskStatusBadgeProps) {
  return (
    <Badge variant={statusVariants[status]} className={className}>
      {statusLabels[status]}
    </Badge>
  );
}

// Repeat pattern badge
const repeatPatternLabels: Record<RepeatPattern, string> = {
  daily: '毎日',
  weekdays: '平日',
  weekly: '毎週',
  monthly: '毎月',
};

interface RepeatPatternBadgeProps {
  pattern: RepeatPattern;
  className?: string;
}

export function RepeatPatternBadge({ pattern, className = '' }: RepeatPatternBadgeProps) {
  return (
    <Badge variant="success" className={className}>
      {repeatPatternLabels[pattern]}
    </Badge>
  );
}
