import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Building2,
  MapPin,
  ChevronRight,
  Home,
  Pencil,
  BarChart3,
  Settings2,
} from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { PropertyDetailClient } from '@/components/properties/PropertyDetailClient'
import type { Property, Unit } from '@repo/types'

export const metadata = { title: 'تفاصيل العقار' }

const TYPE_LABELS: Record<string, string> = {
  residential: 'سكني',
  commercial: 'تجاري',
  business_center: 'بيزنس سنتر',
  mixed: 'مختلط',
}

const UNIT_TYPE_LABELS: Record<string, string> = {
  apartment: 'شقة',
  office: 'مكتب',
  retail: 'محل تجاري',
  studio: 'استوديو',
  villa: 'فيلا',
  warehouse: 'مستودع',
}

const UNIT_STATUS_LABELS: Record<string, string> = {
  available: 'متاحة',
  occupied: 'مشغولة',
  maintenance: 'صيانة',
  reserved: 'محجوزة',
}

const UNIT_STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  occupied: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-orange-100 text-orange-700',
  reserved: 'bg-yellow-100 text-yellow-700',
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()

  const [{ data: property }, { data: units }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).single(),
    supabase
      .from('units')
      .select('*')
      .eq('property_id', id)
      .order('unit_number', { ascending: true }),
  ])

  if (!property) notFound()

  const typedUnits = (units ?? []) as Unit[]
  const occupiedCount = typedUnits.filter((u) => u.status === 'occupied').length
  const availableCount = typedUnits.filter((u) => u.status === 'available').length
  const maintenanceCount = typedUnits.filter((u) => u.status === 'maintenance').length
  const occupancyRate =
    typedUnits.length > 0 ? Math.round((occupiedCount / typedUnits.length) * 100) : 0

  return (
    <div className="space-y-6" dir="rtl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard/properties" className="hover:text-foreground transition-colors">
          العقارات
        </Link>
        <ChevronRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground font-medium truncate">{property.name}</span>
      </nav>

      {/* Hero */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {property.images?.[0] ? (
          <div className="h-56 w-full bg-muted overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={property.images[0]}
              alt={property.name}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="h-56 w-full bg-muted flex items-center justify-center">
            <Building2 className="h-20 w-20 text-muted-foreground/20" />
          </div>
        )}

        <div className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{property.name}</h1>
                <span className="text-xs px-2 py-1 rounded-full bg-secondary font-medium">
                  {TYPE_LABELS[property.type] ?? property.type}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    property.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : property.status === 'under_maintenance'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {property.status === 'active'
                    ? 'نشط'
                    : property.status === 'under_maintenance'
                    ? 'تحت الصيانة'
                    : 'غير نشط'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{property.address}{property.city ? `، ${property.city}` : ''}{property.country ? `، ${property.country}` : ''}</span>
              </div>
            </div>

            {/* Edit button (client) */}
            <PropertyDetailClient property={property as Property} />
          </div>

          {property.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{property.description}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الوحدات"
          value={typedUnits.length}
          icon={<Home className="h-5 w-5" />}
          color="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="مشغولة"
          value={occupiedCount}
          icon={<Home className="h-5 w-5" />}
          color="bg-green-50 text-green-700"
        />
        <StatCard
          label="متاحة"
          value={availableCount}
          icon={<Home className="h-5 w-5" />}
          color="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="نسبة الإشغال"
          value={`${occupancyRate}%`}
          icon={<BarChart3 className="h-5 w-5" />}
          color={occupancyRate >= 80 ? 'bg-green-50 text-green-700' : occupancyRate >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}
        />
      </div>

      {/* Units List */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-base">الوحدات ({typedUnits.length})</h2>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/properties/${(property as Property).id}/units`}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-muted transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" />
              إدارة الوحدات
            </Link>
            {maintenanceCount > 0 && (
              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                {maintenanceCount} تحت الصيانة
              </span>
            )}
          </div>
        </div>

        {typedUnits.length === 0 ? (
          <div className="py-16 text-center">
            <Home className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">لا توجد وحدات مضافة لهذا العقار بعد</p>
          </div>
        ) : (
          <div className="divide-y">
            {typedUnits.map((unit) => (
              <div
                key={unit.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Home className="h-4 w-4 text-secondary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">وحدة {unit.unit_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {unit.type ? UNIT_TYPE_LABELS[unit.type] ?? unit.type : '—'}
                      {unit.area ? ` · ${unit.area} م²` : ''}
                      {unit.floor != null ? ` · الطابق ${unit.floor}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {unit.monthly_rent != null && (
                    <span className="text-sm font-semibold hidden sm:block">
                      {unit.monthly_rent.toLocaleString('ar-SA')} ر.س/شهر
                    </span>
                  )}
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      UNIT_STATUS_COLORS[unit.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {UNIT_STATUS_LABELS[unit.status] ?? unit.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className={`inline-flex rounded-md p-2 ${color}`}>{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
