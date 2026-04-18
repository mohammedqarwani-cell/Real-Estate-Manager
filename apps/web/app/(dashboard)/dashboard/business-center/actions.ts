'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

import { SERVICE_PRICES } from '@/lib/booking-services'

// ─── Types ───────────────────────────────────────────────────────

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

// ─── Room Schema ─────────────────────────────────────────────────

const RoomSchema = z.object({
  property_id:   z.string().uuid('يرجى اختيار العقار'),
  name:          z.string().min(1, 'اسم القاعة مطلوب'),
  capacity:      z.coerce.number().int().positive().nullable().optional(),
  hourly_rate:   z.coerce.number().min(0).nullable().optional(),
  half_day_rate: z.coerce.number().min(0).nullable().optional(),
  full_day_rate: z.coerce.number().min(0).nullable().optional(),
  description:   z.string().nullable().optional(),
  status:        z.enum(['available', 'unavailable', 'maintenance']).default('available'),
})

function parseRoomFd(fd: FormData) {
  return RoomSchema.safeParse({
    property_id:   fd.get('property_id'),
    name:          fd.get('name'),
    capacity:      fd.get('capacity') || null,
    hourly_rate:   fd.get('hourly_rate') || null,
    half_day_rate: fd.get('half_day_rate') || null,
    full_day_rate: fd.get('full_day_rate') || null,
    description:   fd.get('description') || null,
    status:        fd.get('status') || 'available',
  })
}

// ─── createMeetingRoom ───────────────────────────────────────────

export async function createMeetingRoom(
  _prev: RoomFormState,
  fd: FormData,
): Promise<RoomFormState> {
  const parsed = parseRoomFd(fd)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }
  const supabase = await createServerClient()
  const { error } = await (supabase.from('meeting_rooms') as any).insert(parsed.data)
  if (error) return { success: false, error: 'حدث خطأ: ' + error.message, fieldErrors: {} }
  revalidatePath('/dashboard/business-center')
  return { success: true, error: null, fieldErrors: {} }
}

// ─── updateMeetingRoom ───────────────────────────────────────────

export async function updateMeetingRoom(
  id: string,
  _prev: RoomFormState,
  fd: FormData,
): Promise<RoomFormState> {
  const parsed = parseRoomFd(fd)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }
  const supabase = await createServerClient()
  const { error } = await (supabase.from('meeting_rooms') as any)
    .update(parsed.data)
    .eq('id', id)
  if (error) return { success: false, error: 'حدث خطأ: ' + error.message, fieldErrors: {} }
  revalidatePath('/dashboard/business-center')
  return { success: true, error: null, fieldErrors: {} }
}

// ─── deleteMeetingRoom ───────────────────────────────────────────

export async function deleteMeetingRoom(
  id: string,
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerClient()
  const { error } = await (supabase.from('meeting_rooms') as any).delete().eq('id', id)
  if (error) return { success: false, error: 'حدث خطأ: ' + error.message }
  revalidatePath('/dashboard/business-center')
  return { success: true, error: null }
}

// ─── createBooking ───────────────────────────────────────────────

export async function createBooking(data: {
  meeting_room_id: string
  date:            string   // 'YYYY-MM-DD'
  start_time:      string   // 'HH:mm'
  end_time:        string   // 'HH:mm'
  tenant_id:       string | null
  visitor_name:    string | null
  services:        string[]
  notes:           string | null
}): Promise<BookingFormState> {

  // ── Validate ─────────────────────────────────────────────────
  const schema = z.object({
    meeting_room_id: z.string().uuid('يرجى اختيار القاعة'),
    date:            z.string().min(1, 'يرجى اختيار التاريخ'),
    start_time:      z.string().min(1, 'يرجى تحديد وقت البداية'),
    end_time:        z.string().min(1, 'يرجى تحديد وقت النهاية'),
    tenant_id:       z.string().uuid().nullable(),
    visitor_name:    z.string().nullable(),
    services:        z.array(z.string()).default([]),
    notes:           z.string().nullable(),
  }).refine(
    (d) => !!(d.tenant_id || (d.visitor_name && d.visitor_name.trim())),
    { message: 'يرجى اختيار مستأجر أو إدخال اسم الزائر', path: ['tenant_id'] }
  )

  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { meeting_room_id, date, start_time, end_time, tenant_id, visitor_name, services, notes } = parsed.data

  const startISO = new Date(`${date}T${start_time}:00`).toISOString()
  const endISO   = new Date(`${date}T${end_time}:00`).toISOString()

  if (new Date(endISO) <= new Date(startISO)) {
    return { success: false, error: 'وقت الانتهاء يجب أن يكون بعد وقت البداية', fieldErrors: {} }
  }

  const supabase = await createServerClient()

  // ── التحقق من تعارض الحجوزات عبر RPC ─────────────────────────
  try {
    const { data: available } = await supabase.rpc('check_booking_availability', {
      p_room_id:    meeting_room_id,
      p_start_time: startISO,
      p_end_time:   endISO,
    })
    if (!available) {
      return {
        success: false,
        error: 'هذه القاعة محجوزة في الوقت المحدد، يرجى اختيار وقت آخر',
        fieldErrors: {},
      }
    }
  } catch {
    // إذا فشل RPC نكمل والـ trigger في DB سيمنع التعارض
  }

  // ── جلب بيانات القاعة لحساب المبلغ ───────────────────────────
  const { data: room } = await (supabase.from('meeting_rooms') as any)
    .select('hourly_rate, half_day_rate, full_day_rate')
    .eq('id', meeting_room_id)
    .single()

  if (!room) {
    return { success: false, error: 'القاعة غير موجودة', fieldErrors: {} }
  }

  // ── حساب المبلغ ───────────────────────────────────────────────
  const durationHours = (new Date(endISO).getTime() - new Date(startISO).getTime()) / 3_600_000
  let bookingType: 'hourly' | 'half_day' | 'full_day' = 'hourly'
  let baseAmount = 0

  if (durationHours >= 7 && room.full_day_rate) {
    bookingType = 'full_day'
    baseAmount  = room.full_day_rate
  } else if (durationHours >= 4 && room.half_day_rate) {
    bookingType = 'half_day'
    baseAmount  = room.half_day_rate
  } else {
    baseAmount = Math.ceil(durationHours) * (room.hourly_rate ?? 0)
  }

  const servicesTotal = services.reduce((sum, s) => sum + (SERVICE_PRICES[s] ?? 0), 0)
  const totalAmount   = baseAmount + servicesTotal

  // ── Insert ────────────────────────────────────────────────────
  const q = supabase.from('bookings') as any
  const { error } = await q.insert({
    meeting_room_id,
    tenant_id:    tenant_id  ?? null,
    visitor_name: visitor_name?.trim() ?? null,
    start_time:   startISO,
    end_time:     endISO,
    booking_type: bookingType,
    amount:       totalAmount,
    status:       'confirmed',
    services,
    notes:        notes?.trim() ?? null,
  })

  if (error) {
    const isOverlap = error.message?.toLowerCase().includes('overlap')
    return {
      success: false,
      error: isOverlap
        ? 'هذه القاعة محجوزة في الوقت المحدد، يرجى اختيار وقت آخر'
        : 'حدث خطأ أثناء إنشاء الحجز: ' + error.message,
      fieldErrors: {},
    }
  }

  revalidatePath('/dashboard/business-center')
  return { success: true, error: null, fieldErrors: {} }
}

// ─── cancelBooking ───────────────────────────────────────────────

export async function cancelBooking(
  id: string,
  reason: string
): Promise<{ success: boolean; error: string | null }> {
  if (!reason.trim()) {
    return { success: false, error: 'يرجى كتابة سبب الإلغاء' }
  }

  const supabase = await createServerClient()
  const q = supabase.from('bookings') as any
  const { error } = await q
    .update({
      status:              'cancelled',
      cancellation_reason: reason.trim(),
    })
    .eq('id', id)

  if (error) {
    return { success: false, error: 'حدث خطأ: ' + error.message }
  }

  revalidatePath('/dashboard/business-center')
  return { success: true, error: null }
}
