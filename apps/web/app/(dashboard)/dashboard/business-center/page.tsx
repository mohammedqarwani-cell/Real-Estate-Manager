import { createServerClient }      from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { BusinessCenterClient }    from '@/components/business-center/BusinessCenterClient'

export const metadata = { title: 'البزنس سنتر' }

export default async function BusinessCenterPage() {
  const supabase = await createServerClient()
  const now      = new Date()

  // ── Date ranges ──────────────────────────────────────────────
  // Calendar range: 1 month back → 1 month forward
  const calStart = startOfMonth(subMonths(now, 1)).toISOString()
  const calEnd   = endOfMonth(now).toISOString()

  // This month
  const monthStart = startOfMonth(now).toISOString()
  const monthEnd   = endOfMonth(now).toISOString()

  // Today
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

  const [roomsResult, bookingsResult, tenantsResult, todayResult, revenueResult, propertiesResult] =
    await Promise.all([
      // All meeting rooms with property info
      (supabase.from('meeting_rooms') as any)
        .select('*, property:properties(id, name)')
        .order('name'),

      // Bookings for calendar range (with relations)
      (supabase.from('bookings') as any)
        .select(`
          *,
          meeting_room:meeting_rooms(id, name),
          tenant:tenants(id, full_name)
        `)
        .gte('start_time', calStart)
        .lte('start_time', calEnd)
        .order('start_time'),

      // Active tenants for booking form
      (supabase.from('tenants') as any)
        .select('id, full_name, company_name')
        .eq('status', 'active')
        .order('full_name'),

      // Today's bookings
      (supabase.from('bookings') as any)
        .select(`
          *,
          meeting_room:meeting_rooms(id, name),
          tenant:tenants(id, full_name)
        `)
        .gte('start_time', todayStart)
        .lte('start_time', todayEnd)
        .order('start_time'),

      // This month revenue (confirmed + completed)
      (supabase.from('bookings') as any)
        .select('amount')
        .gte('start_time', monthStart)
        .lte('start_time', monthEnd)
        .in('status', ['confirmed', 'completed']),

      // Properties for room form
      (supabase.from('properties') as any)
        .select('id, name')
        .eq('status', 'active')
        .order('name'),
    ])

  if (roomsResult.error)   console.error('[BusinessCenterPage] rooms:', roomsResult.error)
  if (bookingsResult.error) console.error('[BusinessCenterPage] bookings:', bookingsResult.error)

  const rooms          = roomsResult.data      ?? []
  const bookings       = bookingsResult.data   ?? []
  const tenants        = tenantsResult.data    ?? []
  const todayBookings  = todayResult.data      ?? []
  const revenueRows    = revenueResult.data    ?? []
  const properties     = propertiesResult.data ?? []

  // Monthly revenue total
  const monthlyRevenue = (revenueRows as any[]).reduce(
    (sum, r) => sum + (r.amount ?? 0), 0
  )

  // Rooms available right now (not booked at current time)
  const nowISO = now.toISOString()
  const busyRoomIds = new Set(
    (bookings as any[])
      .filter((b) => b.status !== 'cancelled' && b.start_time <= nowISO && b.end_time >= nowISO)
      .map((b) => b.meeting_room_id)
  )
  const availableNow = rooms.filter((r: any) => !busyRoomIds.has(r.id)).length

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">البزنس سنتر</h1>
        <p className="text-muted-foreground text-sm mt-1">
          إدارة قاعات الاجتماعات وحجوزات البزنس سنتر
        </p>
      </div>

      <BusinessCenterClient
        rooms={rooms}
        bookings={bookings}
        tenants={tenants}
        todayBookings={todayBookings}
        monthlyRevenue={monthlyRevenue}
        availableNow={availableNow}
        properties={properties}
      />
    </div>
  )
}
