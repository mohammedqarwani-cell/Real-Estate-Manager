-- ============================================================
-- REAL ESTATE MANAGER — Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HELPER: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'admin'
                CHECK (role IN ('admin', 'manager', 'staff', 'tenant')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- 2. TENANTS (المستأجرون)
-- ============================================================
CREATE TABLE public.tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE,
  phone         TEXT,
  national_id   TEXT,
  company_name  TEXT,
  address       TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive', 'blacklisted')),
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_status ON public.tenants(status);
CREATE INDEX idx_tenants_email  ON public.tenants(email);

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- 3. PROPERTIES (العقارات)
-- ============================================================
CREATE TABLE public.properties (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  type         TEXT NOT NULL
                 CHECK (type IN ('residential', 'commercial', 'business_center', 'mixed')),
  address      TEXT NOT NULL,
  city         TEXT,
  country      TEXT NOT NULL DEFAULT 'SA',
  total_units  INTEGER NOT NULL DEFAULT 0,
  description  TEXT,
  amenities    JSONB NOT NULL DEFAULT '[]'::JSONB,
  images       JSONB NOT NULL DEFAULT '[]'::JSONB,
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'inactive', 'under_maintenance')),
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_properties_type   ON public.properties(type);

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- 4. UNITS (الوحدات)
-- ============================================================
CREATE TABLE public.units (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_number   TEXT NOT NULL,
  floor         INTEGER,
  type          TEXT CHECK (type IN ('apartment', 'office', 'retail', 'studio', 'villa', 'warehouse')),
  area          DECIMAL(10, 2),              -- مساحة بالمتر المربع
  bedrooms      INTEGER,
  bathrooms     INTEGER,
  monthly_rent  DECIMAL(10, 2),
  status        TEXT NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
  amenities     JSONB NOT NULL DEFAULT '[]'::JSONB,
  images        JSONB NOT NULL DEFAULT '[]'::JSONB,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, unit_number)
);

CREATE INDEX idx_units_property_id ON public.units(property_id);
CREATE INDEX idx_units_status      ON public.units(status);
CREATE INDEX idx_units_type        ON public.units(type);

CREATE TRIGGER units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Auto-update properties.total_units
CREATE OR REPLACE FUNCTION sync_property_total_units()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.properties
  SET total_units = (
    SELECT COUNT(*) FROM public.units WHERE property_id = COALESCE(NEW.property_id, OLD.property_id)
  )
  WHERE id = COALESCE(NEW.property_id, OLD.property_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_units_count
  AFTER INSERT OR UPDATE OR DELETE ON public.units
  FOR EACH ROW EXECUTE PROCEDURE sync_property_total_units();

-- ============================================================
-- 5. CONTRACTS (العقود)
-- ============================================================
CREATE TABLE public.contracts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id          UUID NOT NULL REFERENCES public.units(id),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id),
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  monthly_rent     DECIMAL(10, 2) NOT NULL,
  security_deposit DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_day      INTEGER NOT NULL DEFAULT 1
                     CHECK (payment_day BETWEEN 1 AND 31),
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'active', 'expired', 'terminated', 'renewed')),
  terms            TEXT,
  document_url     TEXT,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contracts_valid_dates CHECK (end_date > start_date)
);

CREATE INDEX idx_contracts_unit_id    ON public.contracts(unit_id);
CREATE INDEX idx_contracts_tenant_id  ON public.contracts(tenant_id);
CREATE INDEX idx_contracts_status     ON public.contracts(status);
CREATE INDEX idx_contracts_end_date   ON public.contracts(end_date);

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Auto-update unit status when contract changes
CREATE OR REPLACE FUNCTION sync_unit_status_from_contract()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.status = 'active' THEN
    UPDATE public.units SET status = 'occupied' WHERE id = NEW.unit_id;
  ELSIF (TG_OP = 'UPDATE') AND OLD.status = 'active' AND NEW.status IN ('expired', 'terminated') THEN
    UPDATE public.units SET status = 'available' WHERE id = NEW.unit_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_contract_to_unit
  AFTER INSERT OR UPDATE ON public.contracts
  FOR EACH ROW EXECUTE PROCEDURE sync_unit_status_from_contract();

-- ============================================================
-- 6. INVOICES (الفواتير)
-- ============================================================
CREATE SEQUENCE invoice_number_seq START 1000;

CREATE TABLE public.invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id      UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id),
  unit_id          UUID REFERENCES public.units(id) ON DELETE SET NULL,
  invoice_number   TEXT UNIQUE NOT NULL
                     DEFAULT ('INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 5, '0')),
  type             TEXT NOT NULL DEFAULT 'rent'
                     CHECK (type IN ('rent', 'maintenance', 'utility', 'deposit', 'other')),
  amount           DECIMAL(10, 2) NOT NULL,
  tax_amount       DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount     DECIMAL(10, 2) NOT NULL
                     GENERATED ALWAYS AS (amount + tax_amount) STORED,
  due_date         DATE NOT NULL,
  paid_date        DATE,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled', 'partial')),
  payment_method   TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'card', 'online')),
  notes            TEXT,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_tenant_id    ON public.invoices(tenant_id);
CREATE INDEX idx_invoices_contract_id  ON public.invoices(contract_id);
CREATE INDEX idx_invoices_status       ON public.invoices(status);
CREATE INDEX idx_invoices_due_date     ON public.invoices(due_date);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Auto-mark overdue invoices
CREATE OR REPLACE FUNCTION mark_overdue_invoices()
RETURNS void AS $$
BEGIN
  UPDATE public.invoices
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. MAINTENANCE REQUESTS (طلبات الصيانة)
-- ============================================================
CREATE TABLE public.maintenance_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id          UUID REFERENCES public.units(id) ON DELETE SET NULL,
  tenant_id        UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  category         TEXT CHECK (category IN ('plumbing', 'electrical', 'hvac', 'structural', 'cleaning', 'other')),
  priority         TEXT NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  assigned_to      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  estimated_cost   DECIMAL(10, 2),
  actual_cost      DECIMAL(10, 2),
  scheduled_date   TIMESTAMPTZ,
  completed_date   TIMESTAMPTZ,
  images           JSONB NOT NULL DEFAULT '[]'::JSONB,
  notes            TEXT,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_maintenance_unit_id    ON public.maintenance_requests(unit_id);
CREATE INDEX idx_maintenance_tenant_id  ON public.maintenance_requests(tenant_id);
CREATE INDEX idx_maintenance_status     ON public.maintenance_requests(status);
CREATE INDEX idx_maintenance_priority   ON public.maintenance_requests(priority);

CREATE TRIGGER maintenance_updated_at
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Auto-set completed_date
CREATE OR REPLACE FUNCTION set_maintenance_completed_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_date = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintenance_set_completed_date
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE PROCEDURE set_maintenance_completed_date();

-- ============================================================
-- 8. MEETING ROOMS (قاعات الاجتماعات)
-- ============================================================
CREATE TABLE public.meeting_rooms (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  capacity       INTEGER,
  hourly_rate    DECIMAL(10, 2),
  half_day_rate  DECIMAL(10, 2),
  full_day_rate  DECIMAL(10, 2),
  amenities      JSONB NOT NULL DEFAULT '[]'::JSONB,
  images         JSONB NOT NULL DEFAULT '[]'::JSONB,
  status         TEXT NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available', 'unavailable', 'maintenance')),
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meeting_rooms_property_id ON public.meeting_rooms(property_id);
CREATE INDEX idx_meeting_rooms_status      ON public.meeting_rooms(status);

CREATE TRIGGER meeting_rooms_updated_at
  BEFORE UPDATE ON public.meeting_rooms
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- 9. BOOKINGS (الحجوزات)
-- ============================================================
CREATE TABLE public.bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_room_id  UUID NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
  tenant_id        UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  booked_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  booking_type     TEXT NOT NULL DEFAULT 'hourly'
                     CHECK (booking_type IN ('hourly', 'half_day', 'full_day')),
  amount           DECIMAL(10, 2),
  status           TEXT NOT NULL DEFAULT 'confirmed'
                     CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bookings_valid_times CHECK (end_time > start_time)
);

CREATE INDEX idx_bookings_meeting_room_id ON public.bookings(meeting_room_id);
CREATE INDEX idx_bookings_tenant_id       ON public.bookings(tenant_id);
CREATE INDEX idx_bookings_start_time      ON public.bookings(start_time);
CREATE INDEX idx_bookings_status          ON public.bookings(status);

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Prevent overlapping bookings for same room
CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE meeting_room_id = NEW.meeting_room_id
      AND id != NEW.id
      AND status NOT IN ('cancelled')
      AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
  ) THEN
    RAISE EXCEPTION 'Booking overlaps with an existing booking for this room.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_booking_overlap
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE PROCEDURE check_booking_overlap();
