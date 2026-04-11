-- Migration 003: Add payment_cycle to contracts + documents to tenants

-- 1. Payment cycle for contracts
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS payment_cycle text
  CHECK (payment_cycle IN ('monthly', 'quarterly', 'annually'))
  NOT NULL DEFAULT 'monthly';

-- 2. Documents array for tenants (public storage URLs)
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS documents text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.contracts.payment_cycle IS 'دورية الدفع: monthly / quarterly / annually';
COMMENT ON COLUMN public.tenants.documents        IS 'مستندات المستأجر (هوية، جواز …) — مصفوفة روابط Storage';
