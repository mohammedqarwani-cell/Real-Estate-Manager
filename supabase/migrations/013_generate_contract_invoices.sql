-- Migration 013: Invoice schedule generation for any payment cycle
-- Replaces the monthly-only approach with a full schedule generator
-- Works for annual (1), semi-annual (2), quarterly (4), and monthly (12) payment cycles
-- Adds: generate_contract_invoices(UUID) + generate_all_invoices()

-- ─── Single-contract schedule generator ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_contract_invoices(p_contract_id UUID)
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
  c            RECORD;
  v_pcount     INTEGER;
  v_months_gap INTEGER;
  v_base_date  DATE;
  v_due_date   DATE;
  v_last_day   INTEGER;
  v_amount     NUMERIC(12,2);
  v_inv_id     UUID;
  v_inv_num    TEXT;
  v_exists     BOOLEAN;
  i            INTEGER;
BEGIN
  -- Fetch active contract
  SELECT
    con.id             AS contract_id,
    con.tenant_id,
    con.unit_id,
    con.company_id,
    con.monthly_rent,
    con.start_date::DATE AS start_date,
    con.end_date::DATE   AS end_date,
    con.payment_day,
    COALESCE(con.payment_count, 12)  AS payment_count,
    COALESCE(con.payment_amount, 0)  AS payment_amount,
    COALESCE(con.total_amount, 0)    AS total_amount
  INTO c
  FROM public.contracts con
  WHERE con.id = p_contract_id
    AND con.status = 'active';

  IF NOT FOUND THEN
    contract_id    := p_contract_id;
    invoice_id     := NULL;
    invoice_number := NULL;
    skipped        := TRUE;
    skip_reason    := 'العقد غير موجود أو غير ساري';
    RETURN NEXT;
    RETURN;
  END IF;

  v_pcount := c.payment_count;
  IF v_pcount <= 0 THEN v_pcount := 12; END IF;

  -- Months between each payment
  CASE v_pcount
    WHEN 1  THEN v_months_gap := 12;
    WHEN 2  THEN v_months_gap := 6;
    WHEN 3  THEN v_months_gap := 4;
    WHEN 4  THEN v_months_gap := 3;
    WHEN 6  THEN v_months_gap := 2;
    WHEN 12 THEN v_months_gap := 1;
    ELSE
      -- Non-standard: divide contract duration evenly
      v_months_gap := GREATEST(1, ROUND(
        (EXTRACT(YEAR FROM AGE(c.end_date, c.start_date)) * 12 +
         EXTRACT(MONTH FROM AGE(c.end_date, c.start_date)))
        / v_pcount
      )::INTEGER);
  END CASE;

  -- Amount per invoice
  IF c.payment_amount > 0 THEN
    v_amount := c.payment_amount;
  ELSIF c.total_amount > 0 THEN
    v_amount := ROUND(c.total_amount / v_pcount, 2);
  ELSE
    v_amount := ROUND(c.monthly_rent * 12.0 / v_pcount, 2);
  END IF;

  -- Generate v_pcount invoices spread across the contract period
  FOR i IN 0..(v_pcount - 1) LOOP

    -- Start of the target month
    v_base_date := DATE_TRUNC('month',
      c.start_date + (i * v_months_gap * INTERVAL '1 month')
    )::DATE;

    -- Clamp payment_day to last day of month
    v_last_day := EXTRACT(DAY FROM
      (v_base_date + INTERVAL '1 month - 1 day')
    )::INTEGER;

    v_due_date := (
      v_base_date + (LEAST(COALESCE(c.payment_day, 1), v_last_day) - 1) * INTERVAL '1 day'
    )::DATE;

    -- Skip if invoice already exists for this contract + month
    SELECT EXISTS(
      SELECT 1 FROM public.invoices inv
      WHERE inv.contract_id = c.contract_id
        AND inv.type        = 'rent'
        AND DATE_TRUNC('month', inv.due_date) = DATE_TRUNC('month', v_due_date)
    ) INTO v_exists;

    IF v_exists THEN
      contract_id    := c.contract_id;
      invoice_id     := NULL;
      invoice_number := NULL;
      skipped        := TRUE;
      skip_reason    := 'فاتورة موجودة للفترة ' || TO_CHAR(v_due_date, 'YYYY-MM');
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Insert invoice
    INSERT INTO public.invoices (
      contract_id, unit_id, tenant_id, company_id,
      type, amount, tax_amount, due_date, status
    ) VALUES (
      c.contract_id, c.unit_id, c.tenant_id, c.company_id,
      'rent', v_amount, 0, v_due_date, 'pending'
    )
    RETURNING id, invoices.invoice_number
    INTO v_inv_id, v_inv_num;

    contract_id    := c.contract_id;
    invoice_id     := v_inv_id;
    invoice_number := v_inv_num;
    skipped        := FALSE;
    skip_reason    := NULL;
    RETURN NEXT;

  END LOOP;
END;
$$;

-- ─── All-contracts schedule generator ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_all_invoices()
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
  v_cid UUID;
BEGIN
  FOR v_cid IN
    SELECT id FROM public.contracts WHERE status = 'active'
  LOOP
    RETURN QUERY SELECT * FROM public.generate_contract_invoices(v_cid);
  END LOOP;
END;
$$;
