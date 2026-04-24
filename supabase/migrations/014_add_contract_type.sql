-- Migration 014: Add contract_type to contracts table

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS contract_type TEXT NOT NULL DEFAULT 'full_time'
  CHECK (contract_type IN ('full_time', 'part_time'));

COMMENT ON COLUMN contracts.contract_type IS 'نوع العقد: full_time (دوام كامل) | part_time (دوام جزئي)';
