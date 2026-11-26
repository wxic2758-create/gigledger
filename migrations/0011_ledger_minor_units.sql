-- Retain the USD columns for old clients and rollback; new writes carry integer cents as well.
ALTER TABLE workspaces ADD COLUMN cash_on_hand_cents INTEGER;
ALTER TABLE workspaces ADD COLUMN monthly_income_estimate_cents INTEGER;
ALTER TABLE fixed_costs ADD COLUMN amount_cents INTEGER;
ALTER TABLE fixed_cost_versions ADD COLUMN amount_cents INTEGER;
ALTER TABLE expenses ADD COLUMN amount_cents INTEGER;
ALTER TABLE income_entries ADD COLUMN amount_cents INTEGER;
ALTER TABLE income_entries ADD COLUMN platform_fee_cents INTEGER;

-- Backfill cents already present. Preserve sub-cent legacy values for exact decimal normalization at read time.
UPDATE workspaces SET cash_on_hand_cents = CAST(ROUND(cash_on_hand * 100) AS INTEGER)
WHERE cash_on_hand = ROUND(cash_on_hand * 100) / 100.0 AND ABS(cash_on_hand) <= 90071992547409.91;
UPDATE workspaces SET monthly_income_estimate_cents = CAST(ROUND(monthly_income_estimate * 100) AS INTEGER)
WHERE monthly_income_estimate = ROUND(monthly_income_estimate * 100) / 100.0 AND ABS(monthly_income_estimate) <= 90071992547409.91;
UPDATE fixed_costs SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER)
WHERE amount = ROUND(amount * 100) / 100.0 AND ABS(amount) <= 90071992547409.91;
UPDATE fixed_cost_versions SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER)
WHERE amount = ROUND(amount * 100) / 100.0 AND ABS(amount) <= 90071992547409.91;
UPDATE expenses SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER)
WHERE amount = ROUND(amount * 100) / 100.0 AND ABS(amount) <= 90071992547409.91;
UPDATE income_entries SET amount_cents = CAST(ROUND(amount * 100) AS INTEGER)
WHERE amount = ROUND(amount * 100) / 100.0 AND ABS(amount) <= 90071992547409.91;
UPDATE income_entries SET platform_fee_cents = CAST(ROUND(platform_fee * 100) AS INTEGER)
WHERE platform_fee = ROUND(platform_fee * 100) / 100.0 AND ABS(platform_fee) <= 90071992547409.91;
