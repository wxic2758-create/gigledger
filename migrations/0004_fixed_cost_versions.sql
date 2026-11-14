ALTER TABLE fixed_costs ADD COLUMN is_subscription INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fixed_costs ADD COLUMN template_key TEXT;
ALTER TABLE fixed_costs ADD COLUMN product_url TEXT;
ALTER TABLE fixed_costs ADD COLUMN manage_url TEXT;
ALTER TABLE fixed_costs ADD COLUMN next_billing_date TEXT;
ALTER TABLE fixed_costs ADD COLUMN start_date TEXT;
ALTER TABLE fixed_costs ADD COLUMN end_date TEXT;

CREATE TABLE IF NOT EXISTS fixed_cost_versions (
  id TEXT PRIMARY KEY,
  fixed_cost_id TEXT NOT NULL REFERENCES fixed_costs(id),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  amount REAL NOT NULL,
  cycle TEXT NOT NULL,
  business_use REAL NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(fixed_cost_id, effective_from)
);

UPDATE fixed_costs SET start_date = COALESCE(start_date, substr(created_at, 1, 10));

INSERT INTO fixed_cost_versions
  (id, fixed_cost_id, effective_from, effective_to, amount, cycle, business_use, created_at, updated_at)
SELECT id, id, start_date, end_date, amount, cycle, business_use, created_at, updated_at
FROM fixed_costs
WHERE NOT EXISTS (
  SELECT 1 FROM fixed_cost_versions WHERE fixed_cost_id = fixed_costs.id
);
