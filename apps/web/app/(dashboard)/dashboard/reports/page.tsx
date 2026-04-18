import { createServerClient } from '@/lib/supabase/server'
import { subMonths, startOfMonth } from 'date-fns'
import { ReportsClient } from '@/components/reports/ReportsClient'

export const metadata = { title: 'التقارير' }

export default async function ReportsPage() {
  const supabase = await createServerClient()
  const now = new Date()

  // Last 24 months window for financial data
  const twoYearsAgo = subMonths(startOfMonth(now), 23).toISOString().split('T')[0]

  const [
    paidInvoicesResult,
    unitsResult,
    overdueInvoicesResult,
    bookingsResult,
  ] = await Promise.all([
    // ── Paid invoices for financial report (last 24 months) ──
    (supabase.from('invoices') as any)
      .select('paid_date, total_amount, type')
      .eq('status', 'paid')
      .gte('paid_date', twoYearsAgo)
      .order('paid_date', { ascending: true }),

    // ── All units for occupancy report ──
    (supabase.from('units') as any)
      .select('id, status, property:properties(id, name)'),

    // ── Overdue invoices for overdue report ──
    (supabase.from('invoices') as any)
      .select(`
        id, invoice_number, total_amount, due_date,
        tenant:tenants(id, full_name, phone),
        unit:units(id, unit_number, property:properties(id, name))
      `)
      .eq('status', 'overdue')
      .order('total_amount', { ascending: false }),

    // ── Bookings for business center revenue ──
    (supabase.from('bookings') as any)
      .select(`
        id, start_time, amount, status,
        meeting_room:meeting_rooms(id, name, property:properties(id, name))
      `)
      .in('status', ['confirmed', 'completed'])
      .gte('start_time', twoYearsAgo)
      .order('start_time', { ascending: true }),
  ])

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">التقارير</h1>
        <p className="text-muted-foreground text-sm mt-1">
          تقارير مالية وإشغال وتصدير البيانات
        </p>
      </div>

      <ReportsClient
        paidInvoices={paidInvoicesResult.data ?? []}
        units={unitsResult.data ?? []}
        overdueInvoices={overdueInvoicesResult.data ?? []}
        bookings={bookingsResult.data ?? []}
      />
    </div>
  )
}
