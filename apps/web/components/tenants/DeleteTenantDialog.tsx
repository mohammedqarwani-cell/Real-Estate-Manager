'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteTenant } from '@/app/(dashboard)/dashboard/tenants/actions'

interface DeleteTenantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  tenantName: string
  onSuccess: () => void
}

export function DeleteTenantDialog({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  onSuccess,
}: DeleteTenantDialogProps) {
  const [confirmText, setConfirmText] = useState('')
  const [isPending, startTransition] = useTransition()

  const isMatch = confirmText.trim() === tenantName.trim()

  function handleClose(isOpen: boolean) {
    if (!isPending) {
      setConfirmText('')
      onOpenChange(isOpen)
    }
  }

  function handleDelete() {
    if (!isMatch) return
    startTransition(async () => {
      const result = await deleteTenant(tenantId)
      if (result.success) {
        toast.success('تم حذف المستأجر نهائياً')
        setConfirmText('')
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(result.error ?? 'حدث خطأ أثناء الحذف')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-destructive/10 shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="text-destructive">حذف المستأجر نهائياً</DialogTitle>
          </div>
          <DialogDescription className="text-right leading-relaxed">
            أنت على وشك حذف{' '}
            <span className="font-semibold text-foreground">{tenantName}</span>{' '}
            بشكل نهائي. هذا الإجراء لا يمكن التراجع عنه وسيؤدي إلى:
          </DialogDescription>
        </DialogHeader>

        <ul className="text-sm text-muted-foreground space-y-1.5 bg-muted/50 rounded-lg px-4 py-3">
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-0.5">•</span>
            حذف بيانات المستأجر الشخصية كاملةً
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-0.5">•</span>
            قطع الارتباط بجميع عقوده وفواتيره
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-0.5">•</span>
            حذف جميع مستنداته المرفوعة
          </li>
        </ul>

        <div className="space-y-2">
          <Label htmlFor="confirm-name" className="text-sm">
            اكتب{' '}
            <span className="font-semibold text-foreground select-none">
              {tenantName}
            </span>{' '}
            للتأكيد:
          </Label>
          <Input
            id="confirm-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={tenantName}
            disabled={isPending}
            autoComplete="off"
            className={confirmText && !isMatch ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {confirmText && !isMatch && (
            <p className="text-xs text-destructive">الاسم غير مطابق</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isPending}
          >
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isMatch || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? 'جاري الحذف...' : 'حذف نهائياً'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
