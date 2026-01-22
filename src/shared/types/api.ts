export interface Task {
  id: string;
  title: string;
  description?: string;
  scheduledDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'carried_over';
  estimatedMinutes?: number;
  actualMinutes?: number | null;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    hasMore?: boolean;
  };
}
