'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { createBooking } from '@/app/(dashboard)/dashboard/bookings/actions'

// ─── Types ──────────────────────────────────────────────────

interface Room {
  id: string; name: string; capacity: number | null
  hourly_rate: number | null; half_day_rate: number | null; full_day_rate: number | null
  status: string
  property: { id: string; name: string } | null
}

interface Tenant { id: string; full_name: string }

interface BookingFormDialogProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
  onSuccess:    () => void
  rooms:        Room[]
  tenants:      Tenant[]
}

// ─── Helpers ────────────────────────────────────────────────

function calcAmount(room: Room | undefined, type: string, start: string, end: string): number {
  if (!room) return 0
  if (type === 'half_day') return room.half_day_rate ?? 0
  if (type === 'full_day') return room.full_day_rate ?? 0
  if (type === 'hourly' && start && end) {
    const h = (new Date(end).getTime() - new Date(start).getTime()) / 3600000
    return Math.max(0, Math.round(h * (room.hourly_rate ?? 0) * 100) / 100)
  }
  return 0
}

// ─── Component ──────────────────────────────────────────────

export function BookingFormDialog({
  open, onOpenChange, onSuccess, rooms, tenants,
}: BookingFormDialogProps) {
  const [isPending, startTransition] = useTransition()

  const [roomId,      setRoomId]      = useState('')
  const [tenantId,    setTenantId]    = useState('')
  const [bookingType, setBookingType] = useState('hourly')
  const [startTime,   setStartTime]   = useState('')
  const [endTime,     setEndTime]     = useState('')
  const [notes,       setNotes]       = useState('')
  const [formError,   setFormError]   = useState<string | null>(null)

  const selectedRoom = rooms.find((r) => r.id === roomId)
  const amount = calcAmount(selectedRoom, bookingType, startTime, endTime)

  // Auto-set end time for half/full day
  useEffect(() => {
    if (!startTime) return
    if (bookingType === 'half_day') {
      const d = new Date(startTime)
      d.setHours(d.getHours() + 4)
      setEndTime(d.toISOString().slice(0, 16))
    } else if (bookingType === 'full_day') {
      const d = new Date(startTime)
      d.setHours(d.getHours() + 8)
      setEndTime(d.toISOString().slice(0, 16))
    }
  }, [bookingType, startTime])

  const availableRooms = rooms.filter((r) => r.status === 'available')
  const roomOptions = availableRooms.map((r) => ({
    value: r.id,
    label: r.name,
    sub:   r.property?.name ?? '',
  }))
  const tenantOptions = tenants.map((t) => ({
    value: t.id,
    label: t.full_name,
  }))

  function handleClose() {
    onOpenChange(false)
    setRoomId(''); setTenantId(''); setBookingType('hourly')
    setStartTime(''); setEndTime(''); setNotes(''); setFormError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!roomId) { setFormError('يرجى اختيار القاعة'); return }
    if (!startTime || !endTime) { setFormError('يرجى تحديد وقت البدء والانتهاء'); return }
    if (new Date(endTime) <= new Date(startTime)) { setFormError('وقت الانتهاء يجب أن يكون بعد وقت البدء'); return }

    const fd = new FormData()
    fd.set('meeting_room_id', roomId)
    fd.set('tenant_id', tenantId || '')
    fd.set('booking_type', bookingType)
    fd.set('start_time', new Date(startTime).toISOString())
    fd.set('end_time', new Date(endTime).toISOString())
    fd.set('amount', String(amount))
    fd.set('notes', notes)

    startTransition(async () => {
      const result = await createBooking({ success: false, error: null, fieldErrors: {} }, fd)
      if (result.success) {
        toast.success('تم إنشاء الحجز بنجاح')
        handleClose()
        onSuccess()
      } else {
        setFormError(result.error)
        toast.error(result.error ?? 'حدث خطأ')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>حجز جديد</DialogTitle>
          <DialogDescription className="sr-only">إنشاء حجز جديد لقاعة اجتماعات</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Room */}
          <div className="space-y-1.5">
            <Label>القاعة <span className="text-destructive">*</span></Label>
            <Combobox
              options={roomOptions}
              value={roomId}
              onValueChange={setRoomId}
              placeholder="اختر القاعة..."
              searchPlaceholder="ابحث عن القاعة..."
              emptyMessage="لا توجد قاعات متاحة"
            />
          </div>

          {/* Room rates info */}
          {selectedRoom && (
            <div className="rounded-lg bg-muted/40 p-3 grid grid-cols-3 gap-3 text-xs text-center">
              <div>
                <p className="text-muted-foreground">ساعي</p>
                <p className="font-semibold">{selectedRoom.hourly_rate ?? '—'} د.إ</p>
              </div>
              <div>
                <p className="text-muted-foreground">نصف يوم</p>
                <p className="font-semibold">{selectedRoom.half_day_rate ?? '—'} د.إ</p>
              </div>
              <div>
                <p className="text-muted-foreground">يوم كامل</p>
                <p className="font-semibold">{selectedRoom.full_day_rate ?? '—'} د.إ</p>
              </div>
            </div>
          )}

          {/* Tenant */}
          <div className="space-y-1.5">
            <Label>المستأجر (اختياري)</Label>
            <Combobox
              options={tenantOptions}
              value={tenantId}
              onValueChange={setTenantId}
              placeholder="اختر المستأجر..."
              searchPlaceholder="ابحث عن المستأجر..."
              emptyMessage="لا يوجد مستأجرون"
            />
          </div>

          {/* Booking type */}
          <div className="space-y-1.5">
            <Label>نوع الحجز <span className="text-destructive">*</span></Label>
            <Select value={bookingType} onValueChange={setBookingType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">بالساعة</SelectItem>
                <SelectItem value="half_day">نصف يوم (4 ساعات)</SelectItem>
                <SelectItem value="full_day">يوم كامل (8 ساعات)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start_time">وقت البدء <span className="text-destructive">*</span></Label>
              <Input
                id="start_time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_time">وقت الانتهاء <span className="text-destructive">*</span></Label>
              <Input
                id="end_time"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Amount (calculated) */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">إجمالي الحجز</span>
            <span className="text-lg font-bold text-primary">
              {amount.toLocaleString('ar-AE')} د.إ
            </span>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="أي ملاحظات إضافية..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {formError && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{formError}</p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>إلغاء</Button>
            <Button type="submit" disabled={isPending || !roomId}>
              {isPending ? 'جارٍ الحجز...' : 'تأكيد الحجز'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
