ALTER TABLE fixed_costs ADD COLUMN is_software INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS fixed_costs_workspace_software_idx
  ON fixed_costs(workspace_id, is_software);
