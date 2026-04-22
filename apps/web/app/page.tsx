import Link from 'next/link'
import {
  Building2,
  Users,
  FileText,
  Wrench,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ArrowLeft,
  Shield,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Building2,
    title: 'إدارة العقارات والوحدات',
    desc: 'أضف عقاراتك ووحداتك مع صور وتفاصيل كاملة، وتتبع حالة كل وحدة بلحظة.',
  },
  {
    icon: Users,
    title: 'إدارة المستأجرين والعقود',
    desc: 'سجّل المستأجرين وأنشئ عقوداً رقمية مع تنبيهات تلقائية قبل انتهاء العقد.',
  },
  {
    icon: FileText,
    title: 'الفواتير والمدفوعات',
    desc: 'توليد فواتير شهرية تلقائي، تسجيل مدفوعات، وتتبع المتأخرات بتقارير مالية واضحة.',
  },
  {
    icon: Wrench,
    title: 'طلبات الصيانة',
    desc: 'استقبل طلبات الصيانة، تابعها بنظام Kanban، وعيّن الفنيين مباشرةً من النظام.',
  },
  {
    icon: CalendarCheck,
    title: 'حجوزات البيزنس سنتر',
    desc: 'أدر قاعات الاجتماعات بنظام حجز ذكي يمنع التداخل ويحسب التكاليف تلقائياً.',
  },
  {
    icon: BarChart3,
    title: 'تقارير وإحصائيات',
    desc: 'لوحة تحكم شاملة مع رسوم بيانية وتصدير Excel وPDF لجميع التقارير.',
  },
]

const PLANS = [
  {
    id: 'free',
    name: 'المجاني',
    price: 'مجاناً',
    period: '',
    badge: null as string | null,
    highlight: false,
    features: [
      '3 عقارات',
      '20 وحدة',
      'مستخدمان',
      'جميع الميزات الأساسية',
      'لوحة تحكم متكاملة',
      'تقارير أساسية',
    ],
  },
  {
    id: 'pro',
    name: 'الاحترافي',
    price: '99 د.إ',
    period: '/شهر',
    badge: 'الأكثر شيوعاً' as string | null,
    highlight: true,
    features: [
      'عقارات غير محدودة',
      'وحدات غير محدودة',
      'مستخدمون غير محدودون',
      'تقارير متقدمة + PDF',
      'إشعارات بريد إلكتروني',
      'دعم أولوية',
    ],
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">عقاري</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/register?plan=free"
              className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              ابدأ مجاناً
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background pt-20 pb-28 text-center px-4">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-1.5 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-primary" />
            منصة SaaS متعددة المستأجرين — بياناتك آمنة ومعزولة تماماً
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
            أدر عقاراتك بذكاء
            <br />
            <span className="text-primary opacity-70">في مكان واحد</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            منصة متكاملة لإدارة العقارات والمستأجرين والفواتير والصيانة وحجوزات البيزنس سنتر — بدون تعقيد، بدون ورق.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/register?plan=free"
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm"
            >
              ابدأ مجاناً الآن
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link
              href="#pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            >
              عرض الباقات
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 bg-muted/20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold">كل ما تحتاجه لإدارة عقاراتك</h2>
            <p className="mt-3 text-muted-foreground text-sm max-w-md mx-auto">
              ست وحدات متكاملة تغطي كل جانب من جوانب إدارة العقارات
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold">باقات بسيطة وشفافة</h2>
            <p className="mt-3 text-muted-foreground text-sm">ابدأ مجاناً وارقِّ متى شئت</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={[
                  'relative rounded-2xl border-2 p-8 flex flex-col',
                  plan.highlight
                    ? 'border-primary bg-primary/5 shadow-lg'
                    : 'border-border bg-card',
                ].join(' ')}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </span>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-sm text-muted-foreground">{plan.period}</span>
                    )}
                  </div>
                  {plan.id === 'pro' && (
                    <p className="text-xs text-primary font-medium mt-1">تجربة 14 يوم مجاناً</p>
                  )}
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/register?plan=${plan.id}`}
                  className={[
                    'block text-center py-3 rounded-xl font-semibold text-sm transition-colors',
                    plan.highlight
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                  ].join(' ')}
                >
                  ابدأ الآن
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/20 py-10 px-4 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary">
            <Building2 className="h-3 w-3 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">عقاري</span>
        </div>
        <p>منصة متكاملة لإدارة العقارات — جميع الحقوق محفوظة © 2026</p>
        <div className="flex items-center justify-center gap-4 mt-3">
          <Link href="/login" className="hover:text-foreground transition-colors">تسجيل الدخول</Link>
          <Link href="/register" className="hover:text-foreground transition-colors">إنشاء حساب</Link>
        </div>
      </footer>
    </div>
  )
}
