ALTER TABLE integrations ADD COLUMN report_vendor_number TEXT;

CREATE TABLE app_store_financial_reports (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  vendor_number TEXT NOT NULL,
  period TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  proceeds_json TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, vendor_number, period)
);
