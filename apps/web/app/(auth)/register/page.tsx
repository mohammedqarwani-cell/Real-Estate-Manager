'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Building2, Loader2, Mail, Lock, User, MailCheck } from 'lucide-react'
import { registerAction, type RegisterState } from './actions'

const INITIAL_STATE: RegisterState = { error: null, fieldErrors: {} }

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const plan = (searchParams.get('plan') === 'pro' ? 'pro' : 'free') as 'free' | 'pro'

  const [state, formAction, isPending] = useActionState(registerAction, INITIAL_STATE)

  // حالة: Supabase يشترط تأكيد البريد قبل تفعيل الحساب
  if (state.emailConfirmationRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-muted/30 px-4">
        <div className="w-full max-w-md p-8 bg-background rounded-2xl shadow-lg border text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 mx-auto">
            <MailCheck className="h-8 w-8 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold">تحقق من بريدك الإلكتروني</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            تم إنشاء حسابك بنجاح. أرسلنا لك رابط تفعيل على بريدك الإلكتروني.
            <br />
            بعد التفعيل، سجّل دخولك وستنتقل مباشرةً لإعداد شركتك.
          </p>
          <Link
            href="/login"
            className="inline-block mt-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            الانتقال لتسجيل الدخول
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-muted/30 px-4">
      <div className="w-full max-w-md space-y-8 p-8 bg-background rounded-2xl shadow-lg border">

        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-2">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">إنشاء حساب جديد</h1>
          <p className="text-sm text-muted-foreground">
            {plan === 'pro' ? 'ستبدأ بتجربة الباقة الاحترافية 14 يوماً مجاناً' : 'ستبدأ بالباقة المجانية'}
          </p>
        </div>

        {/* Plan badge */}
        <div className={[
          'text-center text-xs font-medium py-1.5 px-3 rounded-full',
          plan === 'pro'
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground',
        ].join(' ')}>
          {plan === 'pro' ? '✦ الباقة الاحترافية' : 'الباقة المجانية'}
        </div>

        {/* Error */}
        {state.error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-5">
          <input type="hidden" name="plan" value={plan} />

          {/* Full Name */}
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="text-sm font-medium text-foreground">
              الاسم الكامل
            </label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="محمد أحمد"
                required
                autoComplete="name"
                className="w-full pr-10 pl-3 py-2.5 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
            {state.fieldErrors.fullName && (
              <p className="text-xs text-destructive">{state.fieldErrors.fullName[0]}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full pr-10 pl-3 py-2.5 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
            {state.fieldErrors.email && (
              <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              كلمة المرور
            </label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="password"
                name="password"
                type="password"
                placeholder="8 أحرف على الأقل"
                required
                autoComplete="new-password"
                className="w-full pr-10 pl-3 py-2.5 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
            {state.fieldErrors.password && (
              <p className="text-xs text-destructive">{state.fieldErrors.password[0]}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري إنشاء الحساب...
              </>
            ) : (
              'إنشاء الحساب'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </div>
  )
}
