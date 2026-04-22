'use client'

import { useActionState, useState, useEffect } from 'react'
import { Sparkles, CheckCircle2, Loader2 } from 'lucide-react'
import { createCompany, type OnboardingFormState } from '@/app/(onboarding)/onboarding/actions'

const INITIAL_STATE: OnboardingFormState = { success: false, error: null, fieldErrors: {} }

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const PLANS = [
  {
    id: 'free' as const,
    name: 'المجاني',
    price: 'مجاناً',
    features: ['3 عقارات', '20 وحدة', 'مستخدمان', 'جميع الميزات الأساسية'],
    badge: null,
  },
  {
    id: 'pro' as const,
    name: 'الاحترافي',
    price: 'تجربة 14 يوم مجاناً',
    features: ['عقارات غير محدودة', 'وحدات غير محدودة', 'مستخدمون غير محدودون', 'دعم أولوية'],
    badge: 'الأكثر شيوعاً',
  },
]

export function CompanySetupForm({ initialPlan = 'free' }: { initialPlan?: 'free' | 'pro' }) {
  // استخدام القيمة الثالثة من useActionState للـ isPending — يتوافق مع redirect() في Server Actions
  const [state, formAction, isPending] = useActionState(createCompany, INITIAL_STATE)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro'>(initialPlan)

  useEffect(() => {
    if (!slugEdited) {
      setSlug(slugify(name))
    }
  }, [name, slugEdited])

  function handleSlugChange(value: string) {
    setSlugEdited(true)
    setSlug(slugify(value) || value.toLowerCase())
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* Company Name */}
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          اسم الشركة / المؤسسة
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: شركة النور للعقارات"
          className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          dir="rtl"
        />
        {state.fieldErrors.name && (
          <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <label htmlFor="slug" className="text-sm font-medium text-foreground">
          معرّف الشركة (URL)
        </label>
        <div className="flex items-center rounded-lg border border-input bg-muted/40 overflow-hidden focus-within:ring-2 focus-within:ring-primary">
          <span className="px-3 text-xs text-muted-foreground whitespace-nowrap select-none">
            app.example.com/
          </span>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="my-company"
            className="flex-1 bg-transparent py-2.5 pr-1 pl-3.5 text-sm focus:outline-none"
            dir="ltr"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          أحرف إنجليزية صغيرة، أرقام، وشرطة فقط
        </p>
        {state.fieldErrors.slug && (
          <p className="text-xs text-destructive">{state.fieldErrors.slug[0]}</p>
        )}
      </div>

      {/* Plan Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">اختر الباقة</label>
        <div className="grid grid-cols-2 gap-3">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlan(plan.id)}
              className={[
                'relative text-right p-4 rounded-xl border-2 transition-all',
                selectedPlan === plan.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/40',
              ].join(' ')}
            >
              {plan.badge && (
                <span className="absolute -top-2.5 left-3 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {plan.badge}
                </span>
              )}
              <p className="font-semibold text-sm">{plan.name}</p>
              <p className="text-xs text-primary font-medium mt-0.5">{plan.price}</p>
              <ul className="mt-2 space-y-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
        <input type="hidden" name="plan" value={selectedPlan} />
      </div>

      {/* Error */}
      {state.error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || !name.trim() || !slug.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {isPending ? 'جارٍ الإنشاء...' : 'إنشاء الشركة والبدء'}
      </button>
    </form>
  )
}
