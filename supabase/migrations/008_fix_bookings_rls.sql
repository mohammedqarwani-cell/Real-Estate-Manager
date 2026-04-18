-- ================================================================
-- Migration 008: Fix bookings RLS + Fix tenants/contracts policies
--
-- نفس بق migration 002: JOIN auth.users في policies الـ bookings
-- و tenants و contracts يُسبب "permission denied for table users".
-- الحل: حذف الـ policies وإعادة كتابتها بدون JOIN لـ auth.users.
-- ================================================================

-- ── 1. Fix bookings_select ───────────────────────────────────

DROP POLICY IF EXISTS "bookings_select" ON public.bookings;

CREATE POLICY "bookings_select" ON public.bookings
  FOR SELECT
  USING (
    public.is_admin_or_manager()
    OR public.get_user_role() = 'staff'
  );

-- ── 2. Fix tenants_select (كان يحتوي JOIN auth.users) ────────

DROP POLICY IF EXISTS "tenants_select" ON public.tenants;

CREATE POLICY "tenants_select" ON public.tenants
  FOR SELECT
  USING (
    public.is_admin_or_manager()
    OR public.get_user_role() = 'staff'
    OR public.get_user_role() = 'maintenance'
    OR public.get_user_role() = 'accountant'
  );

-- ── 3. Fix contracts_select (كان يحتوي JOIN auth.users) ──────

DROP POLICY IF EXISTS "contracts_select" ON public.contracts;

CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT
  USING (
    public.is_admin_or_manager()
    OR public.get_user_role() = 'staff'
  );
