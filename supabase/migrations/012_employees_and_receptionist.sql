-- ============================================================
-- REAL ESTATE MANAGER — Employees & Receptionist Role
-- Migration: 012_employees_and_receptionist.sql
-- ============================================================

-- ============================================================
-- 1. ADD receptionist TO profiles role CHECK CONSTRAINT
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'accountant', 'maintenance', 'receptionist', 'staff', 'tenant'));

-- ============================================================
-- 2. HELPER FUNCTION — can_access_bookings
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_bookings()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'receptionist')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 3. EMPLOYEES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.employees (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id           uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name                 text NOT NULL,
  email                text NOT NULL,
  phone                text,
  role                 text NOT NULL
                       CHECK (role IN ('admin', 'manager', 'accountant', 'maintenance', 'receptionist')),
  status               text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'inactive')),
  invited_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at            timestamptz,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  CONSTRAINT employees_email_company_unique UNIQUE (company_id, email)
);

CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id    ON public.employees(user_id);

CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. EMPLOYEE INVITATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.employee_invitations (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  email        text NOT NULL,
  role         text NOT NULL
               CHECK (role IN ('manager', 'accountant', 'maintenance', 'receptionist')),
  token        text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at   timestamptz DEFAULT now() + interval '7 days',
  accepted_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_invitations_token      ON public.employee_invitations(token);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_company_id ON public.employee_invitations(company_id);

-- ============================================================
-- 5. RLS — EMPLOYEES
-- ============================================================

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select" ON public.employees
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "employees_insert" ON public.employees
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.is_admin()
  );

CREATE POLICY "employees_update" ON public.employees
  FOR UPDATE
  USING (company_id = public.get_user_company_id() AND public.is_admin())
  WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin());

CREATE POLICY "employees_delete" ON public.employees
  FOR DELETE USING (
    company_id = public.get_user_company_id()
    AND public.is_admin()
  );

-- ============================================================
-- 6. RLS — EMPLOYEE INVITATIONS
-- ============================================================

ALTER TABLE public.employee_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_select" ON public.employee_invitations
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "invitations_insert" ON public.employee_invitations
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.is_admin()
  );

-- ============================================================
-- 7. UPDATE EXISTING POLICIES — allow receptionist
-- ============================================================

-- Tenants: receptionist can view visitor data (needed for booking forms)
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
CREATE POLICY "tenants_select" ON public.tenants
  FOR SELECT USING (
    company_id = public.get_user_company_id()
    AND (public.is_admin_or_manager() OR public.can_access_bookings())
  );

-- Bookings update: add receptionist
DROP POLICY IF EXISTS "bookings_update" ON public.bookings;
CREATE POLICY "bookings_update" ON public.bookings
  FOR UPDATE
  USING (
    company_id = public.get_user_company_id()
    AND public.can_access_bookings()
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.can_access_bookings()
  );

-- Meeting rooms: receptionist can view (already allowed via company_id only, no change needed)
-- Meeting rooms insert/update: keep admin_or_manager only (receptionist doesn't manage rooms)
