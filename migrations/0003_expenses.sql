CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  external_ref TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  category TEXT NOT NULL,
  merchant TEXT,
  amount REAL NOT NULL,
  business_use REAL NOT NULL DEFAULT 100,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS expenses_workspace_ref_unique
  ON expenses(workspace_id, external_ref);

CREATE INDEX IF NOT EXISTS expenses_workspace_idx
  ON expenses(workspace_id, occurred_on);
