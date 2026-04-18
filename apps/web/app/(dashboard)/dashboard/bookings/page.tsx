import { createServerClient } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns'
import { BookingsPageClient } from '@/components/bookings/BookingsPageClient'

export const metadata = { title: 'الحجوزات' }

export default async function BookingsPage() {
  const supabase = await createServerClient()
  const now = new Date()
  const todayStart   = startOfDay(now).toISOString()
  const todayEnd     = endOfDay(now).toISOString()
  const monthStart   = startOfMonth(now).toISOString()
  const monthEnd     = endOfMonth(now).toISOString()

  const [
    bookingsResult,
    roomsResult,
    propertiesResult,
    tenantsResult,
    todayCountResult,
    monthRevenueResult,
  ] = await Promise.all([
    // All bookings with joins
    (supabase.from('bookings') as any).select(`
      *,
      meeting_room:meeting_rooms(id, name, capacity, hourly_rate, half_day_rate, full_day_rate,
        property:properties(id, name)),
      tenant:tenants(id, full_name, phone)
    `).order('start_time', { ascending: false }),

    // All meeting rooms
    (supabase.from('meeting_rooms') as any).select(`
      *,
      property:properties(id, name)
    `).order('name'),

    // Properties for filter + room form
    (supabase.from('properties') as any)
      .select('id, name')
      .eq('status', 'active')
      .order('name'),

    // Tenants for booking form
    (supabase.from('tenants') as any)
      .select('id, full_name, phone')
      .eq('status', 'active')
      .order('full_name'),

    // Today's bookings count
    (supabase.from('bookings') as any)
      .select('id', { count: 'exact', head: true })
      .neq('status', 'cancelled')
      .gte('start_time', todayStart)
      .lte('start_time', todayEnd),

    // This month confirmed revenue
    (supabase.from('bookings') as any)
      .select('amount')
      .in('status', ['confirmed', 'completed'])
      .gte('start_time', monthStart)
      .lte('start_time', monthEnd),
  ])

  if (bookingsResult.error) console.error('[BookingsPage]', bookingsResult.error)
  if (roomsResult.error)    console.error('[BookingsPage] rooms:', roomsResult.error)

  const bookings   = bookingsResult.data  ?? []
  const rooms      = roomsResult.data     ?? []
  const properties = propertiesResult.data ?? []
  const tenants    = tenantsResult.data   ?? []

  const todayCount = todayCountResult.count ?? 0
  const monthRevenue = ((monthRevenueResult.data ?? []) as { amount: number | null }[])
    .reduce((sum, r) => sum + (r.amount ?? 0), 0)

  const upcomingCount = bookings.filter(
    (b: any) => b.status !== 'cancelled' && new Date(b.start_time) > now
  ).length

  return (
    <div className="space-y-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">قاعات الاجتماعات والحجوزات</h1>
        <p className="text-muted-foreground text-sm mt-1">إدارة قاعات الاجتماعات وتتبع الحجوزات</p>
      </div>

      <BookingsPageClient
        bookings={bookings}
        rooms={rooms}
        properties={properties}
        tenants={tenants}
        todayCount={todayCount}
        upcomingCount={upcomingCount}
        monthRevenue={monthRevenue}
      />
    </div>
  )
}
