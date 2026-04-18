-- ================================================================
-- Migration 008: Business Center
--   • أعمدة جديدة في bookings (services, visitor_name, cancellation_reason)
--   • RLS لجدولي meeting_rooms و bookings
--   • دالة can_access_bookings() بـ SECURITY DEFINER
--   • دالة check_booking_availability() — RPC للتحقق من التعارض
-- ================================================================

-- ── 1. أعمدة جديدة في bookings ──────────────────────────────────

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS services             JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS visitor_name         TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason  TEXT;

COMMENT ON COLUMN public.bookings.services            IS 'الخدمات الإضافية: [''refreshments'', ''projector'', ''recording'']';
COMMENT ON COLUMN public.bookings.visitor_name        IS 'اسم الزائر الخارجي عند غياب tenant_id';
COMMENT ON COLUMN public.bookings.cancellation_reason IS 'سبب الإلغاء — يُملأ عند status = cancelled';

-- ── 2. دالة can_access_bookings ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_access_bookings()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role IN ('admin', 'manager')
  );
$$;

-- ── 3. check_booking_availability — RPC ─────────────────────────
--
-- يُرجع TRUE إذا كان الوقت متاحاً، FALSE إذا كان محجوزاً.
-- استخدمه من Frontend قبل الإرسال للتحقق الفوري.

CREATE OR REPLACE FUNCTION public.check_booking_availability(
  p_room_id    UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time   TIMESTAMPTZ,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM   public.bookings
    WHERE  meeting_room_id = p_room_id
      AND  status         NOT IN ('cancelled')
      AND  (p_exclude_id IS NULL OR id != p_exclude_id)
      AND  tstzrange(start_time, end_time, '[)')
             && tstzrange(p_start_time, p_end_time, '[)')
  );
$$;

-- ── 4. RLS — meeting_rooms ───────────────────────────────────────

ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meeting_rooms_select" ON public.meeting_rooms;
DROP POLICY IF EXISTS "meeting_rooms_insert" ON public.meeting_rooms;
DROP POLICY IF EXISTS "meeting_rooms_update" ON public.meeting_rooms;
DROP POLICY IF EXISTS "meeting_rooms_delete" ON public.meeting_rooms;

-- أي مستخدم مصادَق عليه يقدر يشوف القاعات
CREATE POLICY "meeting_rooms_select"
  ON public.meeting_rooms FOR SELECT
  USING (auth.role() = 'authenticated');

-- admin/manager فقط يضيفون قاعات
CREATE POLICY "meeting_rooms_insert"
  ON public.meeting_rooms FOR INSERT
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "meeting_rooms_update"
  ON public.meeting_rooms FOR UPDATE
  USING    (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "meeting_rooms_delete"
  ON public.meeting_rooms FOR DELETE
  USING (public.is_admin());

-- ── 5. RLS — bookings ────────────────────────────────────────────

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_select" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update" ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete" ON public.bookings;

-- القراءة: admin/manager أو صاحب الحجز
CREATE POLICY "bookings_select"
  ON public.bookings FOR SELECT
  USING (
    public.can_access_bookings()
    OR booked_by = auth.uid()
  );

-- الإدراج: admin/manager فقط
CREATE POLICY "bookings_insert"
  ON public.bookings FOR INSERT
  WITH CHECK (public.can_access_bookings());

-- التحديث: admin/manager فقط
CREATE POLICY "bookings_update"
  ON public.bookings FOR UPDATE
  USING    (public.can_access_bookings())
  WITH CHECK (public.can_access_bookings());

-- الحذف: admin فقط
CREATE POLICY "bookings_delete"
  ON public.bookings FOR DELETE
  USING (public.is_admin());
