import { createServerClient } from '@/lib/supabase/server'
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { InvoicesClient } from '@/components/invoices/InvoicesClient'
import { FinancialOverview, type MonthlyRevenue, type TopDebtor } from '@/components/invoices/FinancialOverview'

export const metadata = { title: 'الفواتير' }

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string }>
}) {
  const sp = await searchParams
  const supabase = await createServerClient()
  const now = new Date()

  // Run mark_overdue_invoices first (best-effort)
  try { await (supabase.rpc as any)('mark_overdue_invoices') } catch { /* ignore */ }

  const thisMonthStart = startOfMonth(now).toISOString().split('T')[0]
  const thisMonthEnd   = endOfMonth(now).toISOString().split('T')[0]

  // ── Parallel data fetching ─────────────────────────────────────────────
  const [
    invoicesResult,
    tenantsResult,
    contractsResult,
    propertiesResult,
    collectedThisMonthResult,
    overdueResult,
    revenueResult,
  ] = await Promise.all([
    // All invoices with relations
    (supabase.from('invoices') as any).select(`
      *,
      tenant:tenants(id, full_name, email),
      unit:units(id, unit_number, property:properties(id, name))
    `).order('created_at', { ascending: false }),

    // Tenants for the create dialog
    (supabase.from('tenants') as any).select('id, full_name').eq('status', 'active').order('full_name'),

    // Active contracts for the create dialog
    (supabase.from('contracts') as any).select(`
      id, unit_id, monthly_rent, payment_day,
      unit:units(id, unit_number, property:properties(id, name))
    `).eq('status', 'active'),

    // Properties for filtering
    (supabase.from('properties') as any).select('id, name').eq('status', 'active').order('name'),

    // Collected this month (paid invoices)
    (supabase.from('invoices') as any)
      .select('total_amount')
      .eq('status', 'paid')
      .gte('paid_date', thisMonthStart)
      .lte('paid_date', thisMonthEnd),

    // Overdue invoices
    (supabase.from('invoices') as any)
      .select('total_amount, tenant_id, tenant:tenants(id, full_name)')
      .eq('status', 'overdue'),

    // Revenue for last 6 months (paid invoices grouped by month)
    (supabase.from('invoices') as any)
      .select('paid_date, total_amount')
      .eq('status', 'paid')
      .gte('paid_date', subMonths(startOfMonth(now), 5).toISOString().split('T')[0])
      .lte('paid_date', thisMonthEnd),
  ])

  if (invoicesResult.error) console.error('[InvoicesPage] invoices error:', invoicesResult.error)
  if (tenantsResult.error)  console.error('[InvoicesPage] tenants error:', tenantsResult.error)

  const invoices   = invoicesResult.data ?? []
  const tenants    = tenantsResult.data ?? []
  const contracts  = contractsResult.data ?? []
  const properties = propertiesResult.data ?? []

  // ── Financial calculations ─────────────────────────────────────────────

  const collectedThisMonth = ((collectedThisMonthResult.data ?? []) as { total_amount: number }[])
    .reduce((sum, r) => sum + (r.total_amount ?? 0), 0)

  const overdueRows = (overdueResult.data ?? []) as { total_amount: number; tenant_id: string; tenant: { id: string; full_name: string } | null }[]
  const totalOverdue = overdueRows.reduce((sum, r) => sum + (r.total_amount ?? 0), 0)

  // ── Top debtors ────────────────────────────────────────────────────────
  const debtorMap = new Map<string, TopDebtor>()
  for (const row of overdueRows) {
    const tid = row.tenant_id
    if (!debtorMap.has(tid)) {
      debtorMap.set(tid, {
        tenant_id: tid,
        tenant_name: row.tenant?.full_name ?? '—',
        overdue_amount: 0,
        overdue_count: 0,
      })
    }
    const d = debtorMap.get(tid)!
    d.overdue_amount += row.total_amount ?? 0
    d.overdue_count  += 1
  }
  const topDebtors: TopDebtor[] = Array.from(debtorMap.values())
    .sort((a, b) => b.overdue_amount - a.overdue_amount)

  // ── Monthly revenue (last 6 months) ───────────────────────────────────
  const revenueRows = (revenueResult.data ?? []) as { paid_date: string; total_amount: number }[]
  const monthBuckets = new Map<string, MonthlyRevenue>()

  // Pre-populate all 6 months (even empty ones)
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i)
    const key   = format(d, 'yyyy-MM')
    const label = format(d, 'MMM yyyy', { locale: ar })
    monthBuckets.set(key, { month: label, month_key: key, revenue: 0, count: 0 })
  }

  for (const row of revenueRows) {
    const key = row.paid_date.slice(0, 7)
    if (monthBuckets.has(key)) {
      const b = monthBuckets.get(key)!
      b.revenue += row.total_amount ?? 0
      b.count   += 1
    }
  }

  const monthlyRevenue: MonthlyRevenue[] = Array.from(monthBuckets.values())

  return (
    <div className="space-y-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الفواتير والمدفوعات</h1>
        <p className="text-muted-foreground text-sm mt-1">إدارة الفواتير وتتبع المدفوعات</p>
      </div>

      {/* Financial Overview */}
      <FinancialOverview
        collectedThisMonth={collectedThisMonth}
        totalOverdue={totalOverdue}
        overdueCount={overdueRows.length}
        monthlyRevenue={monthlyRevenue}
        topDebtors={topDebtors}
      />

      {/* Invoices Table */}
      <InvoicesClient
        invoices={invoices}
        tenants={tenants}
        contracts={contracts}
        properties={properties}
        defaultSearch={sp?.search}
      />
    </div>
  )
}
