ALTER TABLE fixed_cost_versions ADD COLUMN allocation_json TEXT;

UPDATE fixed_cost_versions
SET allocation_json = (
  SELECT fixed_costs.allocation_json
  FROM fixed_costs
  WHERE fixed_costs.id = fixed_cost_versions.fixed_cost_id
)
WHERE allocation_json IS NULL;
