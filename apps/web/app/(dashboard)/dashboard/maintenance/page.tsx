import { createServerClient } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, differenceInDays, parseISO } from 'date-fns'
import { MaintenanceClient } from '@/components/maintenance/MaintenanceClient'
import { MaintenanceStats } from '@/components/maintenance/MaintenanceStats'

export const metadata = { title: 'الصيانة' }

const CATEGORY_COLORS: Record<string, string> = {
  plumbing:   '#3B82F6',
  electrical: '#F59E0B',
  hvac:       '#10B981',
  structural: '#EF4444',
  cleaning:   '#8B5CF6',
  other:      '#6B7280',
}

const CATEGORY_LABELS: Record<string, string> = {
  plumbing:   'سباكة',
  electrical: 'كهرباء',
  hvac:       'مكيف',
  structural: 'هيكلي',
  cleaning:   'نظافة',
  other:      'أخرى',
}

export default async function MaintenancePage() {
  const supabase = await createServerClient()
  const now = new Date()
  const monthStart = startOfMonth(now).toISOString().split('T')[0]
  const monthEnd   = endOfMonth(now).toISOString().split('T')[0]

  const [
    requestsResult,
    propertiesResult,
    unitsResult,
    techniciansResult,
    completedThisMonthResult,
  ] = await Promise.all([
    (supabase.from('maintenance_requests') as any).select(`
      *,
      unit:units(id, unit_number, property:properties(id, name)),
      tenant:tenants(id, full_name, phone)
    `).order('created_at', { ascending: false }),

    (supabase.from('properties') as any)
      .select('id, name')
      .eq('status', 'active')
      .order('name'),

    (supabase.from('units') as any)
      .select('id, unit_number, property:properties(id, name)')
      .order('unit_number'),

    (supabase.from('profiles') as any)
      .select('id, full_name')
      .in('role', ['admin', 'manager', 'maintenance'])
      .order('full_name'),

    (supabase.from('maintenance_requests') as any)
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_date', monthStart)
      .lte('completed_date', monthEnd),
  ])

  if (requestsResult.error) console.error('[MaintenancePage]', requestsResult.error)

  const requests    = requestsResult.data  ?? []
  const properties  = propertiesResult.data ?? []
  const units       = unitsResult.data      ?? []
  const technicians = techniciansResult.data ?? []
  const completedThisMonth = completedThisMonthResult.count ?? 0

  // ── Stats ──────────────────────────────────────────────────
  const openCount       = requests.filter((r: any) => r.status === 'open').length
  const inProgressCount = requests.filter((r: any) => r.status === 'in_progress').length

  const resolvedWithDates = requests.filter(
    (r: any) => r.status === 'completed' && r.completed_date && r.created_at
  )
  const avgResolutionDays = resolvedWithDates.length > 0
    ? Math.round(
        resolvedWithDates.reduce((sum: number, r: any) => {
          return sum + Math.max(0, differenceInDays(parseISO(r.completed_date), parseISO(r.created_at)))
        }, 0) / resolvedWithDates.length
      )
    : null

  const catMap = new Map<string, number>()
  for (const r of requests) {
    if (r.status === 'cancelled') continue
    const cat = (r.category as string) ?? 'other'
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1)
  }
  const categoryStats = Array.from(catMap.entries())
    .map(([cat, count]) => ({
      name:  CATEGORY_LABELS[cat] ?? cat,
      count,
      color: CATEGORY_COLORS[cat] ?? '#6B7280',
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">طلبات الصيانة</h1>
        <p className="text-muted-foreground text-sm mt-1">إدارة ومتابعة طلبات الصيانة</p>
      </div>

      <MaintenanceStats
        openCount={openCount}
        inProgressCount={inProgressCount}
        completedThisMonth={completedThisMonth}
        avgResolutionDays={avgResolutionDays}
        categoryStats={categoryStats}
      />

      <MaintenanceClient
        requests={requests}
        properties={properties}
        units={units}
        technicians={technicians}
      />
    </div>
  )
}
