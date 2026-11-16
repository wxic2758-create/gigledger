ALTER TABLE workspaces ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE workspaces ADD COLUMN plan_updated_at TEXT;

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  type TEXT NOT NULL CHECK (type IN ('stripe','app_store')),
  status TEXT NOT NULL DEFAULT 'connected',
  account_label TEXT,
  encrypted_credentials TEXT NOT NULL,
  last_sync_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(workspace_id, type)
);
