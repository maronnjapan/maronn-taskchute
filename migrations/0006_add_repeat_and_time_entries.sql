-- Add repeat settings to tasks table
ALTER TABLE tasks ADD COLUMN repeat_pattern TEXT CHECK (repeat_pattern IN ('daily', 'weekdays', 'weekly', 'monthly'));
ALTER TABLE tasks ADD COLUMN repeat_end_date TEXT;

-- Update status constraint: remove 'completed', keep 'pending', 'in_progress', 'carried_over'
-- Note: SQLite doesn't support DROP CONSTRAINT, so we keep existing constraint for backwards compatibility
-- New status values: 'pending' (default), 'in_progress'
-- Migrate existing 'completed' tasks to 'pending'
UPDATE tasks SET status = 'pending' WHERE status = 'completed';

-- Create time_entries table for multiple time recordings per task
CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_minutes INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Index for task_id lookup
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_time_entries_started_at ON time_entries(started_at);

-- Index for repeat pattern queries
CREATE INDEX IF NOT EXISTS idx_tasks_repeat_pattern ON tasks(workspace_id, repeat_pattern) WHERE repeat_pattern IS NOT NULL;
