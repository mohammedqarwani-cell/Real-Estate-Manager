'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast }  from 'sonner'
import { Copy, Check, ExternalLink } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { inviteEmployee, type InviteFormState } from '@/app/(dashboard)/dashboard/employees/actions'

const INITIAL: InviteFormState = { success: false, error: null, fieldErrors: {} }

interface Props {
  open:      boolean
  onClose:   () => void
  companyId: string
}

export function InviteEmployeeDialog({ open, onClose }: Props) {
  const [state, formAction, isPending] = useActionState(inviteEmployee, INITIAL)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  async function copyLink() {
    if (!state.inviteUrl) return
    await navigator.clipboard.writeText(state.inviteUrl)
    setCopied(true)
    toast.success('تم نسخ الرابط')
    setTimeout(() => setCopied(false), 2000)
  }

  function handleClose() {
    setCopied(false)
    onClose()
  }

  // ─── Success state: show invite link ────────────────────────
  if (state.success && state.inviteUrl) {
    return (
      <Dialog open={open} onOpenChange={v => !v && handleClose()}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تم إنشاء الدعوة ✓</DialogTitle>
            <DialogDescription className="sr-only">رابط الدعوة جاهز للمشاركة</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              شارك هذا الرابط مع الموظف عبر واتساب أو أي وسيلة أخرى.
              الرابط صالح لمدة <strong>7 أيام</strong>.
            </p>

            {/* Link box */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
              <span className="flex-1 text-xs text-muted-foreground truncate dir-ltr text-left font-mono">
                {state.inviteUrl}
              </span>
              <button
                onClick={copyLink}
                className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors"
                title="نسخ الرابط"
              >
                {copied
                  ? <Check className="h-4 w-4 text-green-600" />
                  : <Copy  className="h-4 w-4 text-muted-foreground" />
                }
              </button>
              <a
                href={state.inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors"
                title="فتح الرابط"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            </div>

            <p className="text-xs text-muted-foreground/70">
              إذا كان Resend مُعدَّاً، تم إرسال الرابط للإيميل أيضاً.
            </p>

            <Button className="w-full" onClick={handleClose}>
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // ─── Form state ──────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>دعوة موظف جديد</DialogTitle>
          <DialogDescription className="sr-only">نموذج دعوة موظف جديد للانضمام للشركة</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">الاسم الكامل <span className="text-destructive">*</span></Label>
            <Input id="name" name="name" placeholder="أحمد محمد" required />
            {state.fieldErrors.name && (
              <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني <span className="text-destructive">*</span></Label>
            <Input id="email" name="email" type="email" placeholder="employee@company.com" dir="ltr" required />
            {state.fieldErrors.email && (
              <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">رقم الهاتف (اختياري)</Label>
            <Input id="phone" name="phone" placeholder="+971 50 000 0000" dir="ltr" />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label htmlFor="role">الدور <span className="text-destructive">*</span></Label>
            <Select name="role" required defaultValue="">
              <SelectTrigger id="role">
                <SelectValue placeholder="اختر الدور" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">مدير</SelectItem>
                <SelectItem value="accountant">محاسب</SelectItem>
                <SelectItem value="maintenance">فني صيانة</SelectItem>
                <SelectItem value="receptionist">موظف استقبال</SelectItem>
              </SelectContent>
            </Select>
            {state.fieldErrors.role && (
              <p className="text-xs text-destructive">{state.fieldErrors.role[0]}</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? 'جارٍ الإنشاء...' : 'إنشاء رابط الدعوة'}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              إلغاء
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
