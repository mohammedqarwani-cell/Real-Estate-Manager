import { createServerClient } from '@/lib/supabase/server'
import { StatCard } from '@repo/ui'
import {
  Building2,
  Users,
  FileText,
  DollarSign,
  Wrench,
  CalendarCheck,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'

export const metadata = { title: 'لوحة التحكم' }

export default async function DashboardPage() {
  const supabase = await createServerClient()

  // Parallel data fetching
  const [
    { count: totalProperties },
    { count: totalUnits },
    { count: occupiedUnits },
    { count: totalTenants },
    { count: activeContracts },
    { count: pendingInvoices },
    { count: openMaintenance },
    { count: todayBookings },
  ] = await Promise.all([
    supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('units').select('*', { count: 'exact', head: true }),
    supabase.from('units').select('*', { count: 'exact', head: true }).eq('status', 'occupied'),
    supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).in('status', ['pending', 'overdue']),
    supabase.from('maintenance_requests').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
    supabase.from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('start_time', new Date().toISOString().split('T')[0])
      .lt('start_time', new Date(Date.now() + 86400000).toISOString().split('T')[0]),
  ])

  const occupancyRate = totalUnits && occupiedUnits
    ? Math.round((occupiedUnits / totalUnits) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground text-sm mt-1">نظرة عامة على أداء العقارات</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="إجمالي العقارات"
          value={totalProperties ?? 0}
          icon={<Building2 className="h-4 w-4" />}
          description="العقارات النشطة"
        />
        <StatCard
          title="نسبة الإشغال"
          value={`${occupancyRate}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          description={`${occupiedUnits ?? 0} / ${totalUnits ?? 0} وحدة`}
        />
        <StatCard
          title="المستأجرون النشطون"
          value={totalTenants ?? 0}
          icon={<Users className="h-4 w-4" />}
          description="مستأجر نشط"
        />
        <StatCard
          title="العقود النشطة"
          value={activeContracts ?? 0}
          icon={<FileText className="h-4 w-4" />}
          description="عقد ساري المفعول"
        />
        <StatCard
          title="الفواتير المعلقة"
          value={pendingInvoices ?? 0}
          icon={<DollarSign className="h-4 w-4" />}
          description="تحتاج إلى متابعة"
        />
        <StatCard
          title="طلبات الصيانة"
          value={openMaintenance ?? 0}
          icon={<Wrench className="h-4 w-4" />}
          description="طلب مفتوح"
        />
        <StatCard
          title="حجوزات اليوم"
          value={todayBookings ?? 0}
          icon={<CalendarCheck className="h-4 w-4" />}
          description="حجز قاعة اجتماعات"
        />
        <StatCard
          title="تنبيهات"
          value="0"
          icon={<AlertCircle className="h-4 w-4" />}
          description="لا توجد تنبيهات عاجلة"
        />
      </div>
    </div>
  )
}
