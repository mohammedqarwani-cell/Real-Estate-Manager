'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Building2, Loader2, Mail, Lock } from 'lucide-react'
import { loginAction } from './actions'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard'
  const message    = searchParams.get('message')

  const [state, formAction, isPending] = useActionState(loginAction, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-muted/30">
      <div className="w-full max-w-md space-y-8 p-8 bg-background rounded-2xl shadow-lg border">

        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-2">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">مرحباً بك</h1>
          <p className="text-sm text-muted-foreground">
            سجّل دخولك للوصول إلى لوحة التحكم
          </p>
        </div>

        {/* Success message (e.g. after accepting invite) */}
        {message === 'account_created' && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 text-center">
            تم إنشاء حسابك بنجاح! سجّل دخولك للمتابعة.
          </div>
        )}

        {/* Error message */}
        {state?.error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
            {state.error}
          </div>
        )}

        {/* Form — Server Action provides CSRF protection automatically */}
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="redirectTo" value={redirectTo} />

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
                placeholder="admin@example.com"
                required
                autoComplete="email"
                className="w-full pr-10 pl-3 py-2.5 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
          </div>

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
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full pr-10 pl-3 py-2.5 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري تسجيل الدخول...
              </>
            ) : (
              'تسجيل الدخول'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ليس لديك حساب؟{' '}
          <Link href="/register" className="text-primary font-medium hover:underline">
            إنشاء حساب جديد
          </Link>
        </p>
      </div>
    </div>
  )
}
