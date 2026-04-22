'use client'

import { useActionState } from 'react'
import { useEffect }      from 'react'
import { toast }          from 'sonner'
import { Input }          from '@/components/ui/input'
import { Label }          from '@/components/ui/label'
import { Button }         from '@/components/ui/button'
import { acceptInviteAction, type AcceptInviteState } from './actions'

const INITIAL: AcceptInviteState = { success: false, error: null, fieldErrors: {} }

interface Props {
  token:       string
  email:       string
  defaultName: string
}

export function AcceptInviteForm({ token, email, defaultName }: Props) {
  const [state, formAction, isPending] = useActionState(acceptInviteAction, INITIAL)

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  return (
    <form action={formAction} className="bg-card rounded-xl border p-6 space-y-4 shadow-sm">
      <input type="hidden" name="token" value={token} />

      {/* Email (readonly) */}
      <div className="space-y-1.5">
        <Label htmlFor="email-display">البريد الإلكتروني</Label>
        <Input
          id="email-display"
          value={email}
          readOnly
          dir="ltr"
          className="bg-muted/50 cursor-default"
        />
      </div>

      {/* Full Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">الاسم الكامل <span className="text-destructive">*</span></Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultName}
          placeholder="الاسم الكامل"
          required
          autoFocus
        />
        {state.fieldErrors.name && (
          <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="password">كلمة المرور <span className="text-destructive">*</span></Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="8 أحرف على الأقل"
          dir="ltr"
          required
        />
        {state.fieldErrors.password && (
          <p className="text-xs text-destructive">{state.fieldErrors.password[0]}</p>
        )}
      </div>

      {state.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب والانضمام'}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        بالتسجيل توافق على استخدام النظام بالصلاحيات الممنوحة لك
      </p>
    </form>
  )
}
