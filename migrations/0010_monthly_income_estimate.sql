ALTER TABLE workspaces ADD COLUMN monthly_income_estimate REAL
  CHECK (monthly_income_estimate IS NULL OR monthly_income_estimate >= 0);
