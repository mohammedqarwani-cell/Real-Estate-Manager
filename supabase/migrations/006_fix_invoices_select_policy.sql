-- Migration 006: Fix invoices_select policy
-- The nested tenant join in the invoices query triggers the old
-- auth.users access even for admin/manager users.
-- Fix: simplify the policy — accountant role reads all invoices,
-- and align the role check with the actual app roles.

-- Also add accountant/maintenance roles to the profiles CHECK constraint
-- (the original schema only had admin/manager/staff/tenant)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'accountant', 'maintenance', 'staff', 'tenant'));

-- Update get_user_role and helper functions to include new roles
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- New helper: can the current user access financial data?
CREATE OR REPLACE FUNCTION public.can_access_invoices()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'accountant')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Fix invoices policies ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "invoices_select" ON public.invoices;

CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT
  USING (public.can_access_invoices());

DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;

CREATE POLICY "invoices_insert" ON public.invoices
  FOR INSERT
  WITH CHECK (public.can_access_invoices());

DROP POLICY IF EXISTS "invoices_update" ON public.invoices;

CREATE POLICY "invoices_update" ON public.invoices
  FOR UPDATE
  USING (public.can_access_invoices())
  WITH CHECK (public.can_access_invoices());

DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;

CREATE POLICY "invoices_delete" ON public.invoices
  FOR DELETE
  USING (public.is_admin());
