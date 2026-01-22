-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'carried_over')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Primary index for daily task list queries
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_date ON tasks(workspace_id, scheduled_date);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(workspace_id, status);

-- Index for sort order
CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(workspace_id, scheduled_date, sort_order);
