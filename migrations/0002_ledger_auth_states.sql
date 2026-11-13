CREATE TABLE IF NOT EXISTS auth_states (
  state TEXT PRIMARY KEY,
  intent TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  draft_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fixed_costs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  external_ref TEXT NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  cycle TEXT NOT NULL,
  business_use REAL NOT NULL DEFAULT 100,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS income_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  external_ref TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  source TEXT NOT NULL,
  client_name TEXT,
  amount REAL NOT NULL,
  platform_fee REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS fixed_costs_workspace_ref_unique
  ON fixed_costs(workspace_id, external_ref);

CREATE UNIQUE INDEX IF NOT EXISTS income_entries_workspace_ref_unique
  ON income_entries(workspace_id, external_ref);

CREATE INDEX IF NOT EXISTS fixed_costs_workspace_idx
  ON fixed_costs(workspace_id, created_at);

CREATE INDEX IF NOT EXISTS income_entries_workspace_idx
  ON income_entries(workspace_id, occurred_on);
