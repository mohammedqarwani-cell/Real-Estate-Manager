-- ================================================================
-- Migration 008: Notification System
-- Idempotent — آمن للتشغيل أكثر من مرة
-- ================================================================

-- ── 1. جدول notifications ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type        text NOT NULL CHECK (type IN (
                 'overdue_invoice',
                 'expiring_contract',
                 'new_maintenance',
                 'new_booking'
               )),
  title       text NOT NULL,
  body        text NOT NULL,
  read        boolean DEFAULT false NOT NULL,
  entity_id   uuid,
  entity_type text,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx       ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at DESC);

-- ── 2. RLS ────────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ── 3. Realtime ───────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. دالة create_notification() ────────────────────────────

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id     uuid,
  p_type        text,
  p_title       text,
  p_body        text,
  p_entity_id   uuid DEFAULT NULL,
  p_entity_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, entity_id, entity_type)
  VALUES (p_user_id, p_type, p_title, p_body, p_entity_id, p_entity_type)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── 5. دالة notify_admins_and_managers() ─────────────────────

CREATE OR REPLACE FUNCTION public.notify_admins_and_managers(
  p_type        text,
  p_title       text,
  p_body        text,
  p_entity_id   uuid DEFAULT NULL,
  p_entity_type text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, entity_id, entity_type)
  SELECT p.id, p_type, p_title, p_body, p_entity_id, p_entity_type
  FROM public.profiles p
  WHERE p.role IN ('admin', 'manager');
END;
$$;

-- ── 6. دالة check_and_notify_overdue_invoices() ──────────────

CREATE OR REPLACE FUNCTION public.check_and_notify_overdue_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  v_rec   record;
BEGIN
  UPDATE public.invoices
  SET status = 'overdue'
  WHERE status IN ('pending', 'draft') AND due_date < current_date;

  FOR v_rec IN
    SELECT i.id, i.invoice_number, i.total_amount, i.due_date,
           t.full_name AS tenant_name
    FROM public.invoices i
    LEFT JOIN public.tenants t ON t.id = i.tenant_id
    WHERE i.status = 'overdue'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.entity_id = i.id
          AND n.entity_type = 'invoice'
          AND n.type = 'overdue_invoice'
          AND n.created_at::date = current_date
      )
  LOOP
    PERFORM public.notify_admins_and_managers(
      'overdue_invoice',
      'فاتورة متأخرة',
      'الفاتورة ' || v_rec.invoice_number ||
      ' للمستأجر ' || COALESCE(v_rec.tenant_name, 'غير محدد') ||
      ' — المبلغ: ' || v_rec.total_amount::text || ' د.إ' ||
      ' — استحقاق: ' || v_rec.due_date::text,
      v_rec.id,
      'invoice'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── 7. دالة check_and_notify_expiring_contracts() ─────────────

CREATE OR REPLACE FUNCTION public.check_and_notify_expiring_contracts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count     integer := 0;
  v_rec       record;
  v_threshold date;
BEGIN
  v_threshold := current_date + interval '30 days';

  FOR v_rec IN
    SELECT c.id, c.end_date,
           t.full_name AS tenant_name,
           u.unit_number
    FROM public.contracts c
    LEFT JOIN public.tenants t ON t.id = c.tenant_id
    LEFT JOIN public.units   u ON u.id = c.unit_id
    WHERE c.status = 'active'
      AND c.end_date <= v_threshold
      AND c.end_date >= current_date
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.entity_id = c.id
          AND n.entity_type = 'contract'
          AND n.type = 'expiring_contract'
          AND n.created_at::date = current_date
      )
  LOOP
    PERFORM public.notify_admins_and_managers(
      'expiring_contract',
      'عقد قارب على الانتهاء',
      'عقد المستأجر ' || COALESCE(v_rec.tenant_name, 'غير محدد') ||
      ' (وحدة ' || COALESCE(v_rec.unit_number, '—') || ')' ||
      ' ينتهي في ' || v_rec.end_date::text,
      v_rec.id,
      'contract'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── 8. Trigger: إشعار عند maintenance_request جديد ───────────

CREATE OR REPLACE FUNCTION public.notify_new_maintenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_unit_number text;
BEGIN
  SELECT unit_number INTO v_unit_number
  FROM public.units WHERE id = NEW.unit_id;

  PERFORM public.notify_admins_and_managers(
    'new_maintenance',
    'طلب صيانة جديد',
    CASE
      WHEN v_unit_number IS NOT NULL
        THEN 'طلب جديد: ' || NEW.title || ' — الوحدة ' || v_unit_number
      ELSE 'طلب جديد: ' || NEW.title
    END,
    NEW.id,
    'maintenance'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_maintenance ON public.maintenance_requests;
CREATE TRIGGER trg_notify_new_maintenance
  AFTER INSERT ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_maintenance();

-- ── 9. Trigger: إشعار عند booking جديد ───────────────────────

CREATE OR REPLACE FUNCTION public.notify_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_room_name text;
BEGIN
  SELECT name INTO v_room_name
  FROM public.meeting_rooms WHERE id = NEW.meeting_room_id;

  PERFORM public.notify_admins_and_managers(
    'new_booking',
    'حجز قاعة جديد',
    'تم حجز ' || COALESCE(v_room_name, 'قاعة') ||
    ' بتاريخ ' || to_char(NEW.start_time AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD'),
    NEW.id,
    'booking'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_booking ON public.bookings;
CREATE TRIGGER trg_notify_new_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_booking();
