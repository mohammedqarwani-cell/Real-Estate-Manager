-- Migration 009: Flexible payment system for contracts
-- Adds total_amount, payment_count, payment_amount to contracts table

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS total_amount  numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_count int           NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS payment_amount numeric(12,2) NOT NULL DEFAULT 0;

-- Backfill existing contracts from monthly_rent
UPDATE public.contracts
SET
  total_amount   = monthly_rent * 12,
  payment_count  = 12,
  payment_amount = monthly_rent
WHERE total_amount = 0 AND monthly_rent > 0;

COMMENT ON COLUMN public.contracts.total_amount   IS 'إجمالي الإيجار السنوي';
COMMENT ON COLUMN public.contracts.payment_count  IS 'عدد الدفعات (1,2,3,4,12 أو مخصص)';
COMMENT ON COLUMN public.contracts.payment_amount IS 'قيمة كل دفعة = total_amount / payment_count';
