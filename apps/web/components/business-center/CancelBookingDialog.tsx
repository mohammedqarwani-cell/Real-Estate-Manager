'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button }   from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label }    from '@/components/ui/label'
import { cancelBooking } from '@/app/(dashboard)/dashboard/business-center/actions'
import { toast } from 'sonner'

interface Props {
  booking: {
    id:          string
    start_time:  string
    end_time:    string
    meeting_room?: { name: string } | null
    tenant?:       { full_name: string } | null
    visitor_name?: string | null
  } | null
  open:         boolean
  onOpenChange: (v: boolean) => void
  onSuccess:    () => void
}

export function CancelBookingDialog({ booking, open, onOpenChange, onSuccess }: Props) {
  const [reason, setReason]   = useState('')
  const [error,  setError]    = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    if (isPending) return
    setReason('')
    setError(null)
    onOpenChange(false)
  }

  function handleSubmit() {
    if (!booking) return
    setError(null)
    startTransition(async () => {
      const res = await cancelBooking(booking.id, reason)
      if (res.success) {
        toast.success('تم إلغاء الحجز بنجاح')
        setReason('')
        onOpenChange(false)
        onSuccess()
      } else {
        setError(res.error)
      }
    })
  }

  if (!booking) return null

  const guestName = booking.tenant?.full_name ?? booking.visitor_name ?? 'غير محدد'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            إلغاء الحجز
          </DialogTitle>
        </DialogHeader>

        {/* Booking summary */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">القاعة</span>
            <span className="font-medium">{booking.meeting_room?.name ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">الحاجز</span>
            <span className="font-medium">{guestName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">التاريخ</span>
            <span className="font-medium">
              {format(new Date(booking.start_time), 'dd MMM yyyy', { locale: ar })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">الوقت</span>
            <span className="font-medium">
              {format(new Date(booking.start_time), 'HH:mm')} -{' '}
              {format(new Date(booking.end_time), 'HH:mm')}
            </span>
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">سبب الإلغاء <span className="text-destructive">*</span></Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="يرجى كتابة سبب الإلغاء..."
            rows={3}
            disabled={isPending}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
        )}

        <DialogFooter className="flex gap-2 flex-row-reverse">
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isPending || !reason.trim()}
          >
            {isPending ? 'جارٍ الإلغاء...' : 'تأكيد الإلغاء'}
          </Button>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            رجوع
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
