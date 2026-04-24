-- Migration 012: Fix generate_monthly_invoices
-- Restores payment_amount logic (lost in 011) + keeps company_id (added in 011)
-- Return type: TABLE (matches frontend expectations in invoices/actions.ts)
-- Must DROP first because migration 011 changed return type to integer

DROP FUNCTION IF EXISTS public.generate_monthly_invoices(integer, integer);

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
      c.company_id,
      c.monthly_rent,
      c.payment_day,
      COALESCE(c.payment_count,  12) AS payment_count,
      COALESCE(c.payment_amount,  0) AS payment_amount
    FROM public.contracts c
    WHERE c.status = 'active'
  LOOP

    -- Skip non-monthly contracts (quarterly/annual have pre-created invoice schedules)
    IF rec.payment_count <> 12 AND rec.payment_count <> 0 THEN
      contract_id    := rec.contract_id;
      invoice_id     := NULL;
      invoice_number := NULL;
      skipped        := TRUE;
      skip_reason    := 'non-monthly contract — invoices pre-created in schedule';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Build due date: payment_day of p_year/p_month (clamped to last day of month)
    v_due_date := (
      DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1))
      + (LEAST(
           COALESCE(rec.payment_day, 1),
           EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1)) + INTERVAL '1 month - 1 day'))::INTEGER
         ) - 1) * INTERVAL '1 day'
    )::DATE;

    -- Skip if invoice already exists for this contract + month
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

    -- Use payment_amount when set, otherwise fall back to monthly_rent
    v_amount := CASE
      WHEN rec.payment_amount > 0 THEN rec.payment_amount
      ELSE rec.monthly_rent
    END;

    -- Insert invoice
    INSERT INTO public.invoices (
      contract_id,
      unit_id,
      tenant_id,
      company_id,
      type,
      amount,
      tax_amount,
      due_date,
      status
    ) VALUES (
      rec.contract_id,
      rec.unit_id,
      rec.tenant_id,
      rec.company_id,
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
