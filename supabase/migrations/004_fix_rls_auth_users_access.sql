-- Migration 004: Fix RLS policies that directly access auth.users
-- The issue: inline `auth.users` access in policies runs with caller's permissions
-- (anon/authenticated), not with SECURITY DEFINER → "permission denied for table users"
-- Fix: wrap auth.users access in a SECURITY DEFINER helper function

-- ─── Helper: get current authenticated user's email ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_auth_user_email()
RETURNS TEXT AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Fix tenants_select policy ───────────────────────────────────────────────
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;

CREATE POLICY "tenants_select" ON public.tenants
  FOR SELECT
  USING (
    public.is_admin_or_manager()
    OR public.get_user_role() = 'staff'
    OR (
      public.get_user_role() = 'tenant'
      AND email = public.get_auth_user_email()
    )
  );

-- ─── Fix contracts_select policy ────────────────────────────────────────────
DROP POLICY IF EXISTS "contracts_select" ON public.contracts;

CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT
  USING (
    public.is_admin_or_manager()
    OR public.get_user_role() = 'staff'
    OR (
      public.get_user_role() = 'tenant'
      AND tenant_id IN (
        SELECT t.id FROM public.tenants t
        WHERE t.email = public.get_auth_user_email()
      )
    )
  );

-- ─── Fix invoices_select policy ─────────────────────────────────────────────
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;

CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT
  USING (
    public.is_admin_or_manager()
    OR public.get_user_role() = 'staff'
    OR (
      public.get_user_role() = 'tenant'
      AND tenant_id IN (
        SELECT t.id FROM public.tenants t
        WHERE t.email = public.get_auth_user_email()
      )
    )
  );

-- ─── Fix maintenance_select policy ──────────────────────────────────────────
DROP POLICY IF EXISTS "maintenance_select" ON public.maintenance_requests;

CREATE POLICY "maintenance_select" ON public.maintenance_requests
  FOR SELECT
  USING (
    public.is_admin_or_manager()
    OR public.get_user_role() = 'staff'
    OR (
      public.get_user_role() = 'tenant'
      AND tenant_id IN (
        SELECT t.id FROM public.tenants t
        WHERE t.email = public.get_auth_user_email()
      )
    )
  );

-- ─── Fix bookings_select policy ─────────────────────────────────────────────
DROP POLICY IF EXISTS "bookings_select" ON public.bookings;

CREATE POLICY "bookings_select" ON public.bookings
  FOR SELECT
  USING (
    public.is_admin_or_manager()
    OR public.get_user_role() = 'staff'
    OR (
      public.get_user_role() = 'tenant'
      AND (
        booked_by = auth.uid()
        OR tenant_id IN (
          SELECT t.id FROM public.tenants t
          WHERE t.email = public.get_auth_user_email()
        )
      )
    )
  );
