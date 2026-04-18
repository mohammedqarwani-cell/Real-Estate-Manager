-- Migration 010: Add flexible payment columns + fix generate_monthly_invoices
-- Combines 009 columns with corrected function rewrite

-- ─── Step 1: Add columns (safe if already exist) ─────────────────────────
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS total_amount   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_count  int           NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS payment_amount numeric(12,2) NOT NULL DEFAULT 0;

-- ─── Step 2: Backfill existing contracts ─────────────────────────────────
UPDATE public.contracts
SET
  total_amount   = monthly_rent * 12,
  payment_count  = 12,
  payment_amount = monthly_rent
WHERE total_amount = 0 AND monthly_rent > 0;

-- ─── Step 3: Rewrite generate_monthly_invoices ───────────────────────────
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(
  p_year  INTEGER DEFAULT EXTRACT(YEAR  FROM CURRENT_DATE)::INTEGER,
  p_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE(
  contract_id    UUID,
  invoice_id     UUID,
  invoice_number TEXT,
  skipped        BOOLEAN,
  skip_reason    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec        RECORD;
  v_due_date DATE;
  v_inv_id   UUID;
  v_inv_num  TEXT;
  v_amount   NUMERIC(12,2);
BEGIN
  FOR rec IN
    SELECT
      c.id             AS contract_id,
      c.tenant_id,
      c.unit_id,
      c.monthly_rent,
      c.payment_day,
      c.payment_count,
      c.payment_amount
    FROM public.contracts c
    WHERE c.status = 'active'
  LOOP

    -- Skip non-monthly contracts (they have pre-created invoice schedules)
    IF rec.payment_count IS NOT NULL AND rec.payment_count <> 12 AND rec.payment_count <> 0 THEN
      contract_id    := rec.contract_id;
      invoice_id     := NULL;
      invoice_number := NULL;
      skipped        := TRUE;
      skip_reason    := 'non-monthly contract — invoices pre-created in schedule';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Build due date: payment_day of p_year/p_month (clamped to last day)
    v_due_date := (
      DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1))
      + (LEAST(rec.payment_day, EXTRACT(DAY FROM
            (DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1)) + INTERVAL '1 month - 1 day')
         )::INTEGER) - 1) * INTERVAL '1 day'
    )::DATE;

    -- Check for existing invoice this month using FOUND
    PERFORM 1
      FROM public.invoices i
      WHERE i.contract_id = rec.contract_id
        AND i.type        = 'rent'
        AND DATE_TRUNC('month', i.due_date) = DATE_TRUNC('month', v_due_date);

    IF FOUND THEN
      contract_id    := rec.contract_id;
      invoice_id     := NULL;
      invoice_number := NULL;
      skipped        := TRUE;
      skip_reason    := 'invoice already exists for this month';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Use payment_amount if set, otherwise fall back to monthly_rent
    v_amount := CASE
      WHEN rec.payment_amount IS NOT NULL AND rec.payment_amount > 0 THEN rec.payment_amount
      ELSE rec.monthly_rent
    END;

    -- Insert the invoice
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
      v_amount,
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
