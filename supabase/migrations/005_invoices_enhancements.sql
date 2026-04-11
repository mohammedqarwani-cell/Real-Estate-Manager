-- ============================================================
-- REAL ESTATE MANAGER — Invoices Enhancements
-- Migration: 005_invoices_enhancements.sql
-- ============================================================

-- Add reference_number column for bank transfers / cheques
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reference_number TEXT;

-- ============================================================
-- FUNCTION: generate_monthly_invoices
-- Creates rent invoices for all active contracts for the
-- given month (defaults to current month).
-- Skips contracts that already have an invoice for that month.
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(
  p_year  INTEGER DEFAULT EXTRACT(YEAR  FROM CURRENT_DATE)::INTEGER,
  p_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE(
  contract_id   UUID,
  invoice_id    UUID,
  invoice_number TEXT,
  skipped       BOOLEAN,
  skip_reason   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec         RECORD;
  v_due_date  DATE;
  v_inv_id    UUID;
  v_inv_num   TEXT;
  v_exists    BOOLEAN;
BEGIN
  FOR rec IN
    SELECT
      c.id            AS contract_id,
      c.tenant_id,
      c.unit_id,
      c.monthly_rent,
      c.payment_day
    FROM public.contracts c
    WHERE c.status = 'active'
  LOOP
    -- Build the due date: payment_day of p_year/p_month
    -- Clamp day to last day of the month
    v_due_date := (
      DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1))
      + (LEAST(rec.payment_day, EXTRACT(DAY FROM
            (DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1)) + INTERVAL '1 month - 1 day')
         )::INTEGER) - 1) * INTERVAL '1 day'
    )::DATE;

    -- Check for existing invoice this month
    SELECT EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.contract_id = rec.contract_id
        AND i.type        = 'rent'
        AND DATE_TRUNC('month', i.due_date) = DATE_TRUNC('month', v_due_date)
    ) INTO v_exists;

    IF v_exists THEN
      contract_id    := rec.contract_id;
      invoice_id     := NULL;
      invoice_number := NULL;
      skipped        := TRUE;
      skip_reason    := 'invoice already exists for this month';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Insert invoice
    INSERT INTO public.invoices (
      contract_id,
      tenant_id,
      unit_id,
      type,
      amount,
      tax_amount,
      due_date,
      status
    ) VALUES (
      rec.contract_id,
      rec.tenant_id,
      rec.unit_id,
      'rent',
      rec.monthly_rent,
      0,
      v_due_date,
      'pending'
    )
    RETURNING id, invoices.invoice_number
    INTO v_inv_id, v_inv_num;

    contract_id    := rec.contract_id;
    invoice_id     := v_inv_id;
    invoice_number := v_inv_num;
    skipped        := FALSE;
    skip_reason    := NULL;
    RETURN NEXT;
  END LOOP;
END;
$$;
