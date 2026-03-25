-- One-time auth codes for mobile OAuth callback
-- Used to exchange a code (passed via deep link) for a session cookie in the WebView
CREATE TABLE IF NOT EXISTS auth_codes (
  code TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Auto-cleanup: codes expire after 5 minutes
CREATE INDEX IF NOT EXISTS idx_auth_codes_created_at ON auth_codes(created_at);
