import { redirect } from 'next/navigation'
import { CheckCircle2, XCircle, Building2, Users, Home, Zap, Crown, Star } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import type { Company } from '@repo/types'

const PLAN_FEATURES = {
  free: {
    name: 'المجاني',
    icon: Star,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
    price: 'مجاناً',
    features: [
      { label: '3 عقارات كحد أقصى', included: true },
      { label: '20 وحدة كحد أقصى', included: true },
      { label: 'مستخدمان كحد أقصى', included: true },
      { label: 'إدارة العقود والفواتير', included: true },
      { label: 'إدارة الصيانة', included: true },
      { label: 'تقارير أساسية', included: true },
      { label: 'عقارات غير محدودة', included: false },
      { label: 'دعم أولوية', included: false },
    ],
  },
  pro: {
    name: 'الاحترافي',
    icon: Zap,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    price: '99 د.إ / شهرياً',
    features: [
      { label: 'عقارات غير محدودة', included: true },
      { label: 'وحدات غير محدودة', included: true },
      { label: 'مستخدمون غير محدودون', included: true },
      { label: 'إدارة العقود والفواتير', included: true },
      { label: 'إدارة الصيانة', included: true },
      { label: 'تقارير متقدمة + تصدير', included: true },
      { label: 'إشعارات البريد والواتساب', included: true },
      { label: 'دعم أولوية', included: true },
    ],
  },
  enterprise: {
    name: 'المؤسسي',
    icon: Crown,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    price: 'تواصل معنا',
    features: [
      { label: 'كل ما في الاحترافي', included: true },
      { label: 'تكامل مخصص', included: true },
      { label: 'دعم مخصص 24/7', included: true },
      { label: 'SLA مضمون', included: true },
      { label: 'تدريب وإعداد', included: true },
      { label: 'تقارير مخصصة', included: true },
      { label: 'API كامل', included: true },
      { label: 'White-label', included: true },
    ],
  },
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active:    { label: 'نشط',         className: 'bg-green-100 text-green-700' },
    trialing:  { label: 'تجربة مجانية', className: 'bg-blue-100 text-blue-700' },
    past_due:  { label: 'متأخر الدفع', className: 'bg-red-100 text-red-700' },
    canceled:  { label: 'ملغي',        className: 'bg-gray-100 text-gray-700' },
  }
  const badge = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
      {badge.label}
    </span>
  )
}

function UsageBar({ label, used, max, icon: Icon }: {
  label: string
  used: number
  max: number | null
  icon: React.ElementType
}) {
  const isUnlimited = max === null
  const pct = isUnlimited ? 0 : Math.min((used / max) * 100, 100)
  const isWarning = !isUnlimited && pct >= 80

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <span className={`font-medium text-xs ${isWarning ? 'text-orange-600' : 'text-foreground'}`}>
          {isUnlimited ? `${used} / غير محدود` : `${used} / ${max}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isWarning ? 'bg-orange-500' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default async function SubscriptionPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) redirect('/onboarding')

  const [
    { data: company },
    { count: propertiesCount },
    { count: unitsCount },
    { count: usersCount },
  ] = await Promise.all([
    supabase.from('companies').select('*').eq('id', profile.company_id).single(),
    supabase.from('properties').select('id', { count: 'exact', head: true }),
    supabase.from('units').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id),
  ])

  const c = company as Company | null
  const plan = c?.subscription_plan ?? 'free'
  const planInfo = PLAN_FEATURES[plan]
  const PlanIcon = planInfo.icon

  const trialDaysLeft = c?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(c.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null

  return (
    <div className="max-w-3xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold">الاشتراك والباقة</h1>
        <p className="text-sm text-muted-foreground mt-1">إدارة اشتراك شركتك وعرض حدود الاستخدام</p>
      </div>

      {/* Current Plan Card */}
      <div className={`rounded-xl border-2 ${planInfo.borderColor} p-5`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${planInfo.bgColor} flex items-center justify-center`}>
              <PlanIcon className={`h-5 w-5 ${planInfo.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">الباقة الحالية</p>
              <p className="font-bold text-lg">{planInfo.name}</p>
            </div>
          </div>
          <div className="text-left space-y-1">
            <StatusBadge status={c?.subscription_status ?? 'active'} />
            {trialDaysLeft !== null && trialDaysLeft > 0 && (
              <p className="text-xs text-blue-600 font-medium">
                {trialDaysLeft} يوم متبقٍ في التجربة
              </p>
            )}
          </div>
        </div>

        {/* Usage */}
        <div className="mt-5 grid grid-cols-3 gap-4 pt-4 border-t border-border/60">
          <UsageBar label="العقارات" used={propertiesCount ?? 0} max={c?.max_properties ?? null} icon={Building2} />
          <UsageBar label="الوحدات"  used={unitsCount ?? 0}      max={c?.max_units ?? null}       icon={Home} />
          <UsageBar label="المستخدمون" used={usersCount ?? 0}   max={c?.max_users ?? null}       icon={Users} />
        </div>
      </div>

      {/* Plan Comparison */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">مقارنة الباقات</h2>
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(PLAN_FEATURES) as [string, typeof PLAN_FEATURES.free][]).map(([key, info]) => {
            const Icon = info.icon
            const isCurrent = key === plan
            return (
              <div
                key={key}
                className={`rounded-xl border p-4 space-y-3 ${isCurrent ? `border-2 ${info.borderColor} ${info.bgColor}/30` : 'border-border bg-card'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${info.color}`} />
                    <span className="font-semibold text-sm">{info.name}</span>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">
                      حالي
                    </span>
                  )}
                </div>
                <p className={`text-xs font-medium ${info.color}`}>{info.price}</p>
                <ul className="space-y-1.5">
                  {info.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-1.5">
                      {f.included
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                        : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                      }
                      <span className={`text-xs ${f.included ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>
                {!isCurrent && key !== 'free' && (
                  <button
                    disabled
                    className="w-full text-xs py-1.5 rounded-lg border border-primary/30 text-primary font-medium opacity-60 cursor-not-allowed"
                  >
                    {key === 'enterprise' ? 'تواصل معنا' : 'الترقية — قريباً'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Company Info */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold mb-3">معلومات الشركة</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">اسم الشركة</dt>
            <dd className="font-medium mt-0.5">{c?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">المعرّف (Slug)</dt>
            <dd className="font-medium mt-0.5 font-mono text-xs">{c?.slug ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">تاريخ الإنشاء</dt>
            <dd className="font-medium mt-0.5">
              {c?.created_at ? new Date(c.created_at).toLocaleDateString('ar-AE') : '—'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
