import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format, differenceInDays } from 'date-fns'
import { ar } from 'date-fns/locale'
import { ArrowRight, Calendar, DollarSign, Home, User, FileText, AlertTriangle, ShieldCheck } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { ContractDetailClient } from '@/components/contracts/ContractDetailClient'

export const metadata = { title: 'تفاصيل العقد' }

const STATUS_CONFIG = {
  draft:      { label: 'مسودة',  className: 'bg-gray-100 text-gray-700'    },
  active:     { label: 'ساري',   className: 'bg-green-100 text-green-700'  },
  expired:    { label: 'منتهي',  className: 'bg-red-100 text-red-700'      },
  terminated: { label: 'ملغي', className: 'bg-orange-100 text-orange-700' },
  renewed:    { label: 'مجدد',   className: 'bg-blue-100 text-blue-700'    },
}

const PAYMENT_CYCLE_LABELS: Record<string, string> = {
  monthly: 'شهري',
  quarterly: 'ربعي',
  annually: 'سنوي',
}

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: contract } = await (supabase.from('contracts') as any)
    .select(`
      *,
      tenant:tenants(id, full_name, email, phone, national_id, company_name),
      unit:units(id, unit_number, floor, type, area, monthly_rent, property:properties(id, name, address, city))
    `)
    .eq('id', id)
    .single()

  if (!contract) notFound()

  const tenant = contract.tenant
  const unit = contract.unit
  const property = unit?.property
  const status = STATUS_CONFIG[contract.status as keyof typeof STATUS_CONFIG]
  const daysLeft = differenceInDays(new Date(contract.end_date), new Date())
  const isExpiringSoon = contract.status === 'active' && daysLeft >= 0 && daysLeft <= 30

  return (
    <div className="space-y-6" dir="rtl">
      {/* Back + Header */}
      <div>
        <Link
          href="/dashboard/contracts"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowRight className="h-4 w-4" />
          العودة إلى العقود
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">عقد #{id.slice(0, 8).toUpperCase()}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status?.className}`}>
                {status?.label}
              </span>
              {isExpiringSoon && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                  <AlertTriangle className="h-3 w-3" />
                  {daysLeft === 0 ? 'ينتهي اليوم' : `ينتهي خلال ${daysLeft} يوم`}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              تم الإنشاء في {format(new Date(contract.created_at), 'dd MMMM yyyy', { locale: ar })}
            </p>
          </div>
          <ContractDetailClient
            contractId={id}
            contractStatus={contract.status}
            contract={contract}
          />
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Tenant info */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground mb-1">
            <User className="h-4 w-4" />
            بيانات المستأجر
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الاسم</span>
              <span className="font-medium">{tenant?.full_name ?? '—'}</span>
            </div>
            {tenant?.phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الهاتف</span>
                <span>{tenant.phone}</span>
              </div>
            )}
            {tenant?.email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">البريد الإلكتروني</span>
                <span>{tenant.email}</span>
              </div>
            )}
            {tenant?.national_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">رقم الهوية</span>
                <span className="font-mono">{tenant.national_id}</span>
              </div>
            )}
            {tenant?.company_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الشركة</span>
                <span>{tenant.company_name}</span>
              </div>
            )}
          </div>
          {tenant?.id && (
            <Link
              href={`/dashboard/tenants`}
              className="text-xs text-primary hover:underline"
            >
              عرض المستأجر
            </Link>
          )}
        </div>

        {/* Unit info */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground mb-1">
            <Home className="h-4 w-4" />
            بيانات الوحدة
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">رقم الوحدة</span>
              <span className="font-medium">وحدة {unit?.unit_number ?? '—'}</span>
            </div>
            {property && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">العقار</span>
                <span>{property.name}</span>
              </div>
            )}
            {property?.address && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">العنوان</span>
                <span className="text-left">{property.address}{property.city ? `، ${property.city}` : ''}</span>
              </div>
            )}
            {unit?.floor != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الطابق</span>
                <span>{unit.floor}</span>
              </div>
            )}
            {unit?.area && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">المساحة</span>
                <span>{unit.area} م²</span>
              </div>
            )}
          </div>
          {property?.id && (
            <Link
              href={`/dashboard/properties/${property.id}`}
              className="text-xs text-primary hover:underline"
            >
              عرض العقار
            </Link>
          )}
        </div>

        {/* Contract dates */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground mb-1">
            <Calendar className="h-4 w-4" />
            تفاصيل مدة العقد
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">تاريخ البداية</span>
              <span className="font-medium">{format(new Date(contract.start_date), 'dd MMMM yyyy', { locale: ar })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">تاريخ النهاية</span>
              <span className={`font-medium ${isExpiringSoon ? 'text-amber-600' : ''}`}>
                {format(new Date(contract.end_date), 'dd MMMM yyyy', { locale: ar })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">المدة الكلية</span>
              <span>
                {Math.round(
                  differenceInDays(new Date(contract.end_date), new Date(contract.start_date)) / 30
                )} شهر
              </span>
            </div>
            {contract.status === 'active' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الأيام المتبقية</span>
                <span className={daysLeft < 0 ? 'text-red-600' : daysLeft <= 30 ? 'text-amber-600' : 'text-green-600'}>
                  {daysLeft < 0 ? `انتهى منذ ${Math.abs(daysLeft)} يوم` : `${daysLeft} يوم`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Financial info */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            التفاصيل المالية
          </div>
          <div className="space-y-2 text-sm">
            {contract.total_amount > 0 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">إجمالي الإيجار</span>
                  <span className="font-bold text-base">{Number(contract.total_amount).toLocaleString('ar-AE')} د.إ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">عدد الدفعات</span>
                  <span>{contract.payment_count} دفعة</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">قيمة كل دفعة</span>
                  <span className="font-semibold text-green-600">{Number(contract.payment_amount).toLocaleString('ar-AE')} د.إ</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الإيجار الشهري</span>
                <span className="font-bold text-base">{contract.monthly_rent.toLocaleString('ar-AE')} د.إ</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">مبلغ التأمين</span>
              <span>{(contract.security_deposit ?? 0).toLocaleString('ar-AE')} د.إ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Terms */}
      {contract.terms && (
        <div className="rounded-xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            شروط العقد
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{contract.terms}</p>
        </div>
      )}
    </div>
  )
}
