-- ============================================================
-- REAL ESTATE MANAGER — SaaS Multi-Tenant
-- Migration: 011_saas_multitenancy.sql
-- ============================================================

-- ============================================================
-- 1. COMPANIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.companies (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                text NOT NULL,
  slug                text NOT NULL UNIQUE,
  logo_url            text,
  owner_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_plan   text NOT NULL DEFAULT 'free'
                      CHECK (subscription_plan IN ('free', 'pro', 'enterprise')),
  subscription_status text NOT NULL DEFAULT 'active'
                      CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled')),
  trial_ends_at       timestamptz,
  max_properties      int DEFAULT 3,   -- NULL = unlimited
  max_units           int DEFAULT 20,  -- NULL = unlimited
  max_users           int DEFAULT 2,   -- NULL = unlimited
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- 2. ADD company_id TO ALL TABLES
-- ============================================================

ALTER TABLE public.profiles             ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.properties           ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.tenants              ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.units                ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.contracts            ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.invoices             ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.maintenance_requests ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.meeting_rooms        ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.bookings             ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- notifications may not exist in all environments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_company_id             ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_properties_company_id           ON public.properties(company_id);
CREATE INDEX IF NOT EXISTS idx_tenants_company_id              ON public.tenants(company_id);
CREATE INDEX IF NOT EXISTS idx_units_company_id                ON public.units(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company_id            ON public.contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id             ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_company_id ON public.maintenance_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_meeting_rooms_company_id        ON public.meeting_rooms(company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_company_id             ON public.bookings(company_id);

-- ============================================================
-- 3. DEFAULT COMPANY FOR EXISTING DATA
-- ============================================================

INSERT INTO public.companies (
  id, name, slug, subscription_plan, subscription_status,
  max_properties, max_units, max_users
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'الشركة الافتراضية', 'default', 'pro', 'active',
  NULL, NULL, NULL
) ON CONFLICT (id) DO NOTHING;

-- Backfill existing rows
UPDATE public.profiles             SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.properties           SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.tenants              SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.units                SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.contracts            SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.invoices             SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.maintenance_requests SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.meeting_rooms        SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.bookings             SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    EXECUTE 'UPDATE public.notifications SET company_id = ''00000000-0000-0000-0000-000000000001'' WHERE company_id IS NULL';
  END IF;
END $$;

-- Set owner to first admin
UPDATE public.companies
SET owner_id = (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
WHERE id = '00000000-0000-0000-0000-000000000001' AND owner_id IS NULL;

-- ============================================================
-- 4. HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 5. UPDATE generate_monthly_invoices TO SET company_id
-- ============================================================

-- Wrap in DO block so it doesn't fail if function doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_monthly_invoices'
  ) THEN
    -- Drop and recreate with company_id support
    DROP FUNCTION IF EXISTS public.generate_monthly_invoices(integer, integer);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(p_year integer, p_month integer)
RETURNS integer AS $$
DECLARE
  v_count     integer := 0;
  v_due_date  date;
  v_rec       record;
BEGIN
  v_due_date := make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day';

  FOR v_rec IN
    SELECT
      c.id            AS contract_id,
      c.unit_id,
      c.tenant_id,
      c.monthly_rent,
      c.company_id,
      COALESCE(c.payment_day, 1) AS payment_day
    FROM public.contracts c
    WHERE c.status = 'active'
  LOOP
    -- Skip if invoice already exists for this contract/period
    IF EXISTS (
      SELECT 1 FROM public.invoices
      WHERE contract_id = v_rec.contract_id
        AND type = 'rent'
        AND EXTRACT(YEAR  FROM due_date) = p_year
        AND EXTRACT(MONTH FROM due_date) = p_month
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.invoices (
      contract_id, unit_id, tenant_id, company_id,
      type, amount, tax_amount, due_date, status
    ) VALUES (
      v_rec.contract_id, v_rec.unit_id, v_rec.tenant_id, v_rec.company_id,
      'rent', v_rec.monthly_rent, 0,
      make_date(p_year, p_month, LEAST(v_rec.payment_day, 28)),
      'pending'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. RLS POLICIES — DROP OLD, CREATE NEW WITH COMPANY ISOLATION
-- ============================================================

-- === COMPANIES ===
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select" ON public.companies;
DROP POLICY IF EXISTS "companies_insert" ON public.companies;
DROP POLICY IF EXISTS "companies_update" ON public.companies;
DROP POLICY IF EXISTS "companies_delete" ON public.companies;

-- Any authenticated user can read their own company
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING (id = public.get_user_company_id());

-- Anyone can create a company (needed for onboarding)
CREATE POLICY "companies_insert" ON public.companies
  FOR INSERT WITH CHECK (true);

-- Only admin of the company can update it
CREATE POLICY "companies_update" ON public.companies
  FOR UPDATE
  USING (id = public.get_user_company_id() AND public.is_admin())
  WITH CHECK (id = public.get_user_company_id() AND public.is_admin());

-- No delete (protect data integrity)
CREATE POLICY "companies_delete" ON public.companies
  FOR DELETE USING (false);

-- === PROFILES ===
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

-- Users see their own profile OR profiles in same company
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR company_id = public.get_user_company_id()
  );

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can update any profile in their company
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE
  USING (company_id = public.get_user_company_id() AND public.is_admin())
  WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin());

-- Admins can delete profiles in their company (except own)
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (
    company_id = public.get_user_company_id()
    AND public.is_admin()
    AND id <> auth.uid()
  );

-- === TENANTS ===
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update" ON public.tenants;
DROP POLICY IF EXISTS "tenants_delete" ON public.tenants;

CREATE POLICY "tenants_select" ON public.tenants
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.is_admin_or_manager()
  );

CREATE POLICY "tenants_insert" ON public.tenants
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.is_admin_or_manager()
  );

CREATE POLICY "tenants_update" ON public.tenants
  FOR UPDATE
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_manager())
  WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_manager());

CREATE POLICY "tenants_delete" ON public.tenants
  FOR DELETE USING (company_id = public.get_user_company_id() AND public.is_admin());

-- === PROPERTIES ===
DROP POLICY IF EXISTS "properties_select" ON public.properties;
DROP POLICY IF EXISTS "properties_insert" ON public.properties;
DROP POLICY IF EXISTS "properties_update" ON public.properties;
DROP POLICY IF EXISTS "properties_delete" ON public.properties;

CREATE POLICY "properties_select" ON public.properties
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "properties_insert" ON public.properties
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.is_admin_or_manager()
  );

CREATE POLICY "properties_update" ON public.properties
  FOR UPDATE
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_manager())
  WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_manager());

CREATE POLICY "properties_delete" ON public.properties
  FOR DELETE USING (company_id = public.get_user_company_id() AND public.is_admin());

-- === UNITS ===
DROP POLICY IF EXISTS "units_select" ON public.units;
DROP POLICY IF EXISTS "units_insert" ON public.units;
DROP POLICY IF EXISTS "units_update" ON public.units;
DROP POLICY IF EXISTS "units_delete" ON public.units;

CREATE POLICY "units_select" ON public.units
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "units_insert" ON public.units
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.is_admin_or_manager()
  );

CREATE POLICY "units_update" ON public.units
  FOR UPDATE
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_manager())
  WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_manager());

CREATE POLICY "units_delete" ON public.units
  FOR DELETE USING (company_id = public.get_user_company_id() AND public.is_admin());

-- === CONTRACTS ===
DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;

CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.is_admin_or_manager()
  );

CREATE POLICY "contracts_insert" ON public.contracts
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.is_admin_or_manager()
  );

CREATE POLICY "contracts_update" ON public.contracts
  FOR UPDATE
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_manager())
  WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_manager());

CREATE POLICY "contracts_delete" ON public.contracts
  FOR DELETE USING (company_id = public.get_user_company_id() AND public.is_admin());

-- === INVOICES ===
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;

CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.can_access_invoices()
  );

CREATE POLICY "invoices_insert" ON public.invoices
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.can_access_invoices()
  );

CREATE POLICY "invoices_update" ON public.invoices
  FOR UPDATE
  USING (company_id = public.get_user_company_id() AND public.can_access_invoices())
  WITH CHECK (company_id = public.get_user_company_id() AND public.can_access_invoices());

CREATE POLICY "invoices_delete" ON public.invoices
  FOR DELETE USING (company_id = public.get_user_company_id() AND public.is_admin());

-- === MAINTENANCE REQUESTS ===
DROP POLICY IF EXISTS "maintenance_select" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maintenance_insert" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maintenance_update" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maintenance_delete" ON public.maintenance_requests;

CREATE POLICY "maintenance_select" ON public.maintenance_requests
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND public.can_access_maintenance()
  );

CREATE POLICY "maintenance_insert" ON public.maintenance_requests
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.can_access_maintenance()
  );

CREATE POLICY "maintenance_update" ON public.maintenance_requests
  FOR UPDATE
  USING (company_id = public.get_user_company_id() AND public.can_access_maintenance())
  WITH CHECK (company_id = public.get_user_company_id() AND public.can_access_maintenance());

CREATE POLICY "maintenance_delete" ON public.maintenance_requests
  FOR DELETE USING (company_id = public.get_user_company_id() AND public.is_admin());

-- === MEETING ROOMS ===
DROP POLICY IF EXISTS "meeting_rooms_select" ON public.meeting_rooms;
DROP POLICY IF EXISTS "meeting_rooms_insert" ON public.meeting_rooms;
DROP POLICY IF EXISTS "meeting_rooms_update" ON public.meeting_rooms;
DROP POLICY IF EXISTS "meeting_rooms_delete" ON public.meeting_rooms;

CREATE POLICY "meeting_rooms_select" ON public.meeting_rooms
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "meeting_rooms_insert" ON public.meeting_rooms
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.is_admin_or_manager()
  );

CREATE POLICY "meeting_rooms_update" ON public.meeting_rooms
  FOR UPDATE
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_manager())
  WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_manager());

CREATE POLICY "meeting_rooms_delete" ON public.meeting_rooms
  FOR DELETE USING (company_id = public.get_user_company_id() AND public.is_admin());

-- === BOOKINGS ===
DROP POLICY IF EXISTS "bookings_select" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update" ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete" ON public.bookings;

CREATE POLICY "bookings_select" ON public.bookings
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "bookings_insert" ON public.bookings
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "bookings_update" ON public.bookings
  FOR UPDATE
  USING (company_id = public.get_user_company_id() AND public.is_admin_or_manager())
  WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin_or_manager());

CREATE POLICY "bookings_delete" ON public.bookings
  FOR DELETE USING (company_id = public.get_user_company_id() AND public.is_admin());

-- === NOTIFICATIONS (if table exists) ===
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    -- Drop all existing notification policies
    EXECUTE 'DROP POLICY IF EXISTS "notifications_select" ON public.notifications';
    EXECUTE 'DROP POLICY IF EXISTS "notifications_insert" ON public.notifications';
    EXECUTE 'DROP POLICY IF EXISTS "notifications_update" ON public.notifications';
    EXECUTE 'DROP POLICY IF EXISTS "notifications_delete" ON public.notifications';

    -- Recreate: notifications are user-scoped (no company isolation needed since user_id is already unique to a company)
    EXECUTE 'CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (user_id = auth.uid())';
  END IF;
END $$;
