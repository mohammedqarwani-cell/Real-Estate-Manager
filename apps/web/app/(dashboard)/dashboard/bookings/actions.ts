'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getUserCompanyId } from '@/lib/supabase/company'

// ─── Schemas ────────────────────────────────────────────────

const createBookingSchema = z.object({
  meeting_room_id: z.string().uuid('يرجى اختيار قاعة'),
  tenant_id:       z.string().uuid().optional().nullable(),
  booking_type:    z.enum(['hourly', 'half_day', 'full_day']),
  start_time:      z.string().min(1, 'وقت البدء مطلوب'),
  end_time:        z.string().min(1, 'وقت الانتهاء مطلوب'),
  amount:          z.coerce.number().min(0),
  notes:           z.string().optional().nullable(),
})

const createRoomSchema = z.object({
  property_id:    z.string().uuid('يرجى اختيار العقار'),
  name:           z.string().min(2, 'اسم القاعة مطلوب'),
  capacity:       z.coerce.number().int().min(1).optional().nullable(),
  hourly_rate:    z.coerce.number().min(0).optional().nullable(),
  half_day_rate:  z.coerce.number().min(0).optional().nullable(),
  full_day_rate:  z.coerce.number().min(0).optional().nullable(),
  description:    z.string().optional().nullable(),
  status:         z.enum(['available', 'unavailable', 'maintenance']).default('available'),
})

// ─── Types ──────────────────────────────────────────────────

export type BookingFormState = {
  success: boolean
  error: string | null
  fieldErrors: Record<string, string[]>
}

export type RoomFormState = {
  success: boolean
  error: string | null
  fieldErrors: Record<string, string[]>
}

// ─── Booking Actions ────────────────────────────────────────

export async function createBooking(
  _prev: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const raw = {
    meeting_room_id: formData.get('meeting_room_id'),
    tenant_id:       formData.get('tenant_id') || null,
    booking_type:    formData.get('booking_type'),
    start_time:      formData.get('start_time'),
    end_time:        formData.get('end_time'),
    amount:          formData.get('amount') || '0',
    notes:           formData.get('notes') || null,
  }

  const parsed = createBookingSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const company_id = await getUserCompanyId()

  const q = supabase.from('bookings') as any
  const { error } = await q.insert({
    meeting_room_id: parsed.data.meeting_room_id,
    tenant_id:       parsed.data.tenant_id ?? null,
    booked_by:       user?.id ?? null,
    booking_type:    parsed.data.booking_type,
    start_time:      parsed.data.start_time,
    end_time:        parsed.data.end_time,
    amount:          parsed.data.amount,
    status:          'confirmed',
    notes:           parsed.data.notes ?? null,
    company_id,
  })

  if (error) {
    const msg = error.message.includes('prevent_booking_overlap')
      ? 'القاعة محجوزة في هذا الوقت، يرجى اختيار وقت آخر'
      : 'حدث خطأ أثناء إنشاء الحجز: ' + error.message
    return { success: false, error: msg, fieldErrors: {} }
  }

  revalidatePath('/dashboard/bookings')
  return { success: true, error: null, fieldErrors: {} }
}

export async function updateBookingStatus(
  id: string,
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerClient()
  const q = supabase.from('bookings') as any
  const { error } = await q.update({ status }).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/bookings')
  return { success: true, error: null }
}

// ─── Meeting Room Actions ────────────────────────────────────

export async function createMeetingRoom(
  _prev: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  const raw = {
    property_id:   formData.get('property_id'),
    name:          formData.get('name'),
    capacity:      formData.get('capacity') || null,
    hourly_rate:   formData.get('hourly_rate') || null,
    half_day_rate: formData.get('half_day_rate') || null,
    full_day_rate: formData.get('full_day_rate') || null,
    description:   formData.get('description') || null,
    status:        formData.get('status') || 'available',
  }

  const parsed = createRoomSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createServerClient()
  const company_id = await getUserCompanyId()
  const q = supabase.from('meeting_rooms') as any
  const { error } = await q.insert({
    property_id:   parsed.data.property_id,
    name:          parsed.data.name,
    capacity:      parsed.data.capacity ?? null,
    hourly_rate:   parsed.data.hourly_rate ?? null,
    half_day_rate: parsed.data.half_day_rate ?? null,
    full_day_rate: parsed.data.full_day_rate ?? null,
    description:   parsed.data.description ?? null,
    status:        parsed.data.status,
    amenities:     [],
    images:        [],
    company_id,
  })

  if (error) return { success: false, error: error.message, fieldErrors: {} }

  revalidatePath('/dashboard/bookings')
  return { success: true, error: null, fieldErrors: {} }
}

export async function updateMeetingRoom(
  id: string,
  _prev: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  const raw = {
    property_id:   formData.get('property_id'),
    name:          formData.get('name'),
    capacity:      formData.get('capacity') || null,
    hourly_rate:   formData.get('hourly_rate') || null,
    half_day_rate: formData.get('half_day_rate') || null,
    full_day_rate: formData.get('full_day_rate') || null,
    description:   formData.get('description') || null,
    status:        formData.get('status') || 'available',
  }

  const parsed = createRoomSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createServerClient()
  const q = supabase.from('meeting_rooms') as any
  const { error } = await q.update({
    property_id:   parsed.data.property_id,
    name:          parsed.data.name,
    capacity:      parsed.data.capacity ?? null,
    hourly_rate:   parsed.data.hourly_rate ?? null,
    half_day_rate: parsed.data.half_day_rate ?? null,
    full_day_rate: parsed.data.full_day_rate ?? null,
    description:   parsed.data.description ?? null,
    status:        parsed.data.status,
  }).eq('id', id)

  if (error) return { success: false, error: error.message, fieldErrors: {} }

  revalidatePath('/dashboard/bookings')
  return { success: true, error: null, fieldErrors: {} }
}

export async function deleteMeetingRoom(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerClient()
  const q = supabase.from('meeting_rooms') as any
  const { error } = await q.delete().eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/bookings')
  return { success: true, error: null }
}
