CREATE TABLE IF NOT EXISTS subscription_reviews (
  id TEXT PRIMARY KEY,
  fixed_cost_id TEXT NOT NULL REFERENCES fixed_costs(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  period TEXT NOT NULL,
  answer TEXT NOT NULL CHECK (answer IN ('often','sometimes','not_used')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(fixed_cost_id, period)
);

CREATE INDEX IF NOT EXISTS subscription_reviews_fixed_cost_idx
  ON subscription_reviews(fixed_cost_id, period);
