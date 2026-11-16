CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, name)
);
CREATE INDEX IF NOT EXISTS projects_workspace_idx ON projects(workspace_id, archived);
ALTER TABLE fixed_costs ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE fixed_costs ADD COLUMN allocation_json TEXT;
ALTER TABLE income_entries ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE expenses ADD COLUMN project_id TEXT REFERENCES projects(id);
