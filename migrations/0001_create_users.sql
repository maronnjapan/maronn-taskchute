-- Users table (Auth0 user data cache)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  auth0_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Index for Auth0 ID lookup
CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_id);

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
