ALTER TABLE income_entries ADD COLUMN sale_date TEXT;
ALTER TABLE income_entries ADD COLUMN recognition TEXT NOT NULL DEFAULT 'received';
ALTER TABLE income_entries ADD COLUMN payout_status TEXT;
ALTER TABLE income_entries ADD COLUMN integration_id TEXT REFERENCES integrations(id);

CREATE INDEX IF NOT EXISTS income_entries_workspace_recognition_idx
  ON income_entries(workspace_id, recognition, occurred_on);
