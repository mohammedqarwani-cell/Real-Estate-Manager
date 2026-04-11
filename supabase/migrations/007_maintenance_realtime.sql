-- ================================================================
-- Migration 007: Fix maintenance_requests RLS + Enable Realtime
--
-- المشكلة: policies من migration 002 تحتوي على JOIN auth.users
-- مما يسبب "permission denied for table users" لجميع المستخدمين.
-- أيضاً دور 'maintenance' لم يكن مدرجاً في SELECT policy.
--
-- الحل: نفس نهج migration 006 للفواتير:
--   - دالة can_access_maintenance() بـ SECURITY DEFINER
--   - إعادة كتابة policies بدون أي JOIN لـ auth.users
-- ================================================================

-- ── 1. Helper function ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_access_maintenance()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'maintenance')
  );
$$;

-- ── 2. Fix maintenance_requests policies ────────────────────
--
-- الـ policies القديمة تحتوي على:
--   JOIN auth.users u ON u.email = t.email
-- وهذا يسبب permission denied حتى لـ admin.

DROP POLICY IF EXISTS "maintenance_select" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maintenance_insert" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maintenance_update" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maintenance_delete" ON public.maintenance_requests;

-- SELECT: admin/manager/maintenance يشوفون الكل؛ staff يشوف الكل
CREATE POLICY "maintenance_select" ON public.maintenance_requests
  FOR SELECT
  USING (
    public.can_access_maintenance()
    OR public.get_user_role() = 'staff'
  );

-- INSERT: أي مستخدم مصادَق عليه يقدر يرفع طلب
CREATE POLICY "maintenance_insert" ON public.maintenance_requests
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: admin/manager/maintenance/staff يقدرون يحدّثون
CREATE POLICY "maintenance_update" ON public.maintenance_requests
  FOR UPDATE
  USING (
    public.can_access_maintenance()
    OR public.get_user_role() = 'staff'
  )
  WITH CHECK (
    public.can_access_maintenance()
    OR public.get_user_role() = 'staff'
  );

-- DELETE: admin فقط
CREATE POLICY "maintenance_delete" ON public.maintenance_requests
  FOR DELETE
  USING (public.is_admin());

-- ── 3. Enable Realtime ───────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_requests;
