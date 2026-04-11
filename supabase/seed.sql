-- ============================================================
-- SEED DATA — for development & testing
-- ============================================================
-- Run AFTER migrations. Uses service role (bypasses RLS).

-- Insert a sample admin profile
-- NOTE: You must first create the user via Supabase Auth dashboard,
-- then update their profile here.

-- Sample property
INSERT INTO public.properties (name, type, address, city, total_units, status)
VALUES
  ('برج الأعمال المركزي', 'business_center', 'شارع الملك فهد، الرياض', 'الرياض', 0, 'active'),
  ('مجمع النخيل السكني', 'residential',      'حي النزهة، جدة',          'جدة',    0, 'active')
ON CONFLICT DO NOTHING;

-- Sample meeting rooms (linked to first property)
INSERT INTO public.meeting_rooms (property_id, name, capacity, hourly_rate, half_day_rate, full_day_rate, amenities, status)
SELECT
  p.id,
  room.name,
  room.capacity,
  room.hourly_rate,
  room.half_day_rate,
  room.full_day_rate,
  room.amenities::JSONB,
  'available'
FROM public.properties p
CROSS JOIN (
  VALUES
    ('قاعة المجلس A',  10, 150.00,  500.00, 900.00,  '["projector","whiteboard","tv","coffee"]'),
    ('قاعة التدريب B', 20, 200.00,  700.00, 1200.00, '["projector","whiteboard","microphone","podium"]'),
    ('غرفة الاجتماعات C', 6, 100.00, 350.00, 600.00, '["tv","whiteboard"]')
) AS room(name, capacity, hourly_rate, half_day_rate, full_day_rate, amenities)
WHERE p.name = 'برج الأعمال المركزي'
ON CONFLICT DO NOTHING;
