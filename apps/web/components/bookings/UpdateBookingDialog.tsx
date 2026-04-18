'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateBookingStatus } from '@/app/(dashboard)/dashboard/bookings/actions'

// ─── Types ──────────────────────────────────────────────────

interface Booking {
  id: string; booking_type: string; start_time: string; end_time: string
  amount: number | null; status: string; notes: string | null
  meeting_room: { name: string; property?: { name: string } | null } | null
  tenant: { full_name: string } | null
}

interface UpdateBookingDialogProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
  onSuccess:    () => void
  booking:      Booking | null
}

// ─── Config ─────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  hourly: 'بالساعة', half_day: 'نصف يوم', full_day: 'يوم كامل',
}

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'معلق' },
  { value: 'confirmed', label: 'مؤكد' },
  { value: 'completed', label: 'منتهٍ' },
  { value: 'cancelled', label: 'ملغي' },
]

const STATUS_INFO: Record<string, { label: string; class: string }> = {
  pending:   { label: 'معلق',   class: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'مؤكد',   class: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغي',   class: 'bg-red-100 text-red-700' },
  completed: { label: 'منتهٍ',  class: 'bg-gray-100 text-gray-500' },
}

// ─── Component ──────────────────────────────────────────────

export function UpdateBookingDialog({
  open, onOpenChange, onSuccess, booking,
}: UpdateBookingDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState(booking?.status ?? 'confirmed')

  if (!booking) return null

  function handleClose() { onOpenChange(false) }

  function handleSubmit() {
    startTransition(async () => {
      const result = await updateBookingStatus(
        booking!.id,
        status as 'pending' | 'confirmed' | 'cancelled' | 'completed'
      )
      if (result.success) {
        toast.success('تم تحديث الحجز بنجاح')
        handleClose()
        onSuccess()
      } else {
        toast.error(result.error ?? 'حدث خطأ')
      }
    })
  }

  const currentStatus = STATUS_INFO[booking.status]

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>تحديث الحجز</DialogTitle>
          <DialogDescription className="sr-only">تغيير حالة الحجز</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Booking summary */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{booking.meeting_room?.name ?? '—'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(booking.meeting_room as any)?.property?.name}
                </p>
              </div>
              {currentStatus && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${currentStatus.class}`}>
                  {currentStatus.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {format(new Date(booking.start_time), 'dd MMM yyyy', { locale: ar })} ·{' '}
                {format(new Date(booking.start_time), 'HH:mm')} – {format(new Date(booking.end_time), 'HH:mm')}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
              <span className="text-muted-foreground">
                {booking.tenant?.full_name ?? 'بدون مستأجر'} · {TYPE_LABELS[booking.booking_type] ?? booking.booking_type}
              </span>
              <span className="font-semibold">
                {booking.amount != null ? `${booking.amount.toLocaleString('ar-AE')} د.إ` : '—'}
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>الحالة الجديدة</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>إلغاء</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || status === booking.status}
            variant={status === 'cancelled' ? 'destructive' : 'default'}
          >
            {isPending ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
