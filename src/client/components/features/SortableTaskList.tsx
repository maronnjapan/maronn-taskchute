import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TimeEntry } from '../../../shared/types/index';
import { TaskCard } from './TaskCard';

interface SortableTaskItemProps {
  task: Task;
  activeTimeEntry?: TimeEntry | null;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onStartTimeEntry?: (taskId: string) => void;
  onStopTimeEntry?: (taskId: string, timeEntryId: string) => void;
}

function SortableTaskItem({
  task,
  activeTimeEntry,
  onEdit,
  onDelete,
  onStartTimeEntry,
  onStopTimeEntry,
}: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        activeTimeEntry={activeTimeEntry}
        onEdit={onEdit}
        onDelete={onDelete}
        onStartTimeEntry={onStartTimeEntry}
        onStopTimeEntry={onStopTimeEntry}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

interface SortableTaskListProps {
  tasks: Task[];
  activeTimeEntries?: Map<string, TimeEntry>;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onStartTimeEntry?: (taskId: string) => void;
  onStopTimeEntry?: (taskId: string, timeEntryId: string) => void;
  onReorder?: (taskIds: string[]) => void;
  emptyMessage?: string;
}

export function SortableTaskList({
  tasks,
  activeTimeEntries,
  onEditTask,
  onDeleteTask,
  onStartTimeEntry,
  onStopTimeEntry,
  onReorder,
  emptyMessage = 'タスクがありません',
}: SortableTaskListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Local state for immediate visual feedback during drag
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  // Track if we're currently dragging
  const [isDragging, setIsDragging] = useState(false);

  // Create a stable key for props tasks (IDs + sortOrders)
  const propsTasksKey = useMemo(
    () => tasks.map((t) => `${t.id}:${t.sortOrder}`).join(','),
    [tasks]
  );
  const localTasksKey = useMemo(
    () => localTasks.map((t) => `${t.id}:${t.sortOrder}`).join(','),
    [localTasks]
  );

  // Sync local tasks with props when not dragging and props have changed
  // Use the combined key to detect both ID changes and sortOrder changes
  if (!isDragging && propsTasksKey !== localTasksKey) {
    // Use queueMicrotask to avoid updating state during render
    queueMicrotask(() => setLocalTasks(tasks));
  }

  // Always display localTasks to maintain visual consistency
  const tasksToDisplay = localTasks;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeTask = useMemo(
    () => tasksToDisplay.find((t) => t.id === activeId),
    [tasksToDisplay, activeId]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);
      setIsDragging(false);

      if (over && active.id !== over.id) {
        const oldIndex = localTasks.findIndex((t) => t.id === active.id);
        const newIndex = localTasks.findIndex((t) => t.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newTasks = arrayMove(localTasks, oldIndex, newIndex);

          // Update local state for visual feedback until server responds
          setLocalTasks(newTasks);

          const taskIds = newTasks.map((t) => t.id);
          onReorder?.(taskIds);
        }
      }
    },
    [localTasks, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setIsDragging(false);
    // Reset localTasks to props on cancel
    setLocalTasks(tasks);
  }, [tasks]);

  if (tasksToDisplay.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={tasksToDisplay.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {tasksToDisplay.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              activeTimeEntry={activeTimeEntries?.get(task.id)}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onStartTimeEntry={onStartTimeEntry}
              onStopTimeEntry={onStopTimeEntry}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeTask ? (
          <div className="opacity-80">
            <TaskCard
              task={activeTask}
              activeTimeEntry={activeTimeEntries?.get(activeTask.id)}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
