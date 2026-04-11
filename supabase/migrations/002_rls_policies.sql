-- ============================================================
-- REAL ESTATE MANAGER — Row Level Security Policies
-- Migration: 002_rls_policies.sql
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 1. PROFILES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile; admins/managers read all
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_admin_or_manager()
  );

-- Users can update their own profile; admins update all
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only admins can delete profiles
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- 2. TENANTS
-- ============================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Admin/Manager/Staff can read all tenants
-- Tenant users can only read their own record (matched by email)
CREATE POLICY "tenants_select" ON public.tenants
  FOR SELECT
  USING (
    public.is_admin_or_manager()
    OR public.get_user_role() = 'staff'
    OR (
      public.get_user_role() = 'tenant'
      AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Only admin/manager can create tenants
CREATE POLICY "tenants_insert" ON public.tenants
  FOR INSERT
  WITH CHECK (public.is_admin_or_manager());

-- Only admin/manager can update tenants
CREATE POLICY "tenants_update" ON public.tenants
  FOR UPDATE
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- Only admin can delete tenants
CREATE POLICY "tenants_delete" ON public.tenants
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- 3. PROPERTIES
-- ============================================================
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active properties
CREATE POLICY "properties_select" ON public.properties
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admin/manager can create properties
CREATE POLICY "properties_insert" ON public.properties
  FOR INSERT
  WITH CHECK (public.is_admin_or_manager());

-- Only admin/manager can update properties
CREATE POLICY "properties_update" ON public.properties
  FOR UPDATE
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- Only admin can delete properties
CREATE POLICY "properties_delete" ON public.properties
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- 4. UNITS
-- ============================================================
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view units
CREATE POLICY "units_select" ON public.units
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admin/manager/staff can create units
CREATE POLICY "units_insert" ON public.units
  FOR INSERT
  WITH CHECK (public.is_admin_or_manager());

-- Only admin/manager can update units
CREATE POLICY "units_update" ON public.units
  FOR UPDATE
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- Only admin can delete units
CREATE POLICY "units_delete" ON public.units
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- 5. CONTRACTS
-- ============================================================
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Admin/Manager/Staff can view all contracts
-- Tenants can view only their own contracts
CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT
  USING (
    public.is_admin_or_manager()
    OR public.get_user_role() = 'staff'
    OR (
      public.get_user_role() = 'tenant'
      AND tenant_id IN (
        SELECT t.id FROM public.tenants t
        JOIN auth.users u ON u.email = t.email
        WHERE u.id = auth.uid()
      )
    )
  );

-- Only admin/manager can create contracts
CREATE POLICY "contracts_insert" ON public.contracts
  FOR INSERT
  WITH CHECK (public.is_admin_or_manager());

-- Only admin/manager can update contracts
CREATE POLICY "contracts_update" ON public.contracts
  FOR UPDATE
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- Only admin can delete contracts
CREATE POLICY "contracts_delete" ON public.contracts
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- 6. INVOICES
-- ============================================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Admin/Manager/Staff can view all invoices
-- Tenants can view only their own invoices
CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT
  USING (
    public.is_admin_or_manager()
    OR public.get_user_role() = 'staff'
    OR (
      public.get_user_role() = 'tenant'
      AND tenant_id IN (
        SELECT t.id FROM public.tenants t
        JOIN auth.users u ON u.email = t.email
        WHERE u.id = auth.uid()
      )
    )
  );

-- Only admin/manager can create invoices
CREATE POLICY "invoices_insert" ON public.invoices
  FOR INSERT
  WITH CHECK (public.is_admin_or_manager());

-- Only admin/manager can update invoices
CREATE POLICY "invoices_update" ON public.invoices
  FOR UPDATE
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- Only admin can delete invoices
CREATE POLICY "invoices_delete" ON public.invoices
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- 7. MAINTENANCE REQUESTS
-- ============================================================
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Admin/Manager/Staff see all; Tenants see only their own
CREATE POLICY "maintenance_select" ON public.maintenance_requests
  FOR SELECT
  USING (
    public.is_admin_or_manager()
    OR public.get_user_role() = 'staff'
    OR (
      public.get_user_role() = 'tenant'
      AND tenant_id IN (
        SELECT t.id FROM public.tenants t
        JOIN auth.users u ON u.email = t.email
        WHERE u.id = auth.uid()
      )
    )
  );

-- Tenants can submit maintenance requests; staff/admin/manager can also
CREATE POLICY "maintenance_insert" ON public.maintenance_requests
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Admin/Manager/Staff can update; Tenants can update only their open requests
CREATE POLICY "maintenance_update" ON public.maintenance_requests
  FOR UPDATE
  USING (
    public.is_admin_or_manager()
    OR public.get_user_role() = 'staff'
    OR (
      public.get_user_role() = 'tenant'
      AND status = 'open'
      AND tenant_id IN (
        SELECT t.id FROM public.tenants t
        JOIN auth.users u ON u.email = t.email
        WHERE u.id = auth.uid()
      )
    )
  );

-- Only admin can delete
CREATE POLICY "maintenance_delete" ON public.maintenance_requests
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- 8. MEETING ROOMS
-- ============================================================
ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view available meeting rooms
CREATE POLICY "meeting_rooms_select" ON public.meeting_rooms
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admin/manager can manage meeting rooms
CREATE POLICY "meeting_rooms_insert" ON public.meeting_rooms
  FOR INSERT
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "meeting_rooms_update" ON public.meeting_rooms
  FOR UPDATE
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "meeting_rooms_delete" ON public.meeting_rooms
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- 9. BOOKINGS
-- ============================================================
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Admin/Manager/Staff see all; Tenants see only their own
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
          JOIN auth.users u ON u.email = t.email
          WHERE u.id = auth.uid()
        )
      )
    )
  );

-- Authenticated users can create bookings
CREATE POLICY "bookings_insert" ON public.bookings
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Users can update their own bookings; admin/manager can update all
CREATE POLICY "bookings_update" ON public.bookings
  FOR UPDATE
  USING (
    public.is_admin_or_manager()
    OR booked_by = auth.uid()
  );

-- Only admin can delete bookings
CREATE POLICY "bookings_delete" ON public.bookings
  FOR DELETE
  USING (public.is_admin());
