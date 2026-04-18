'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { createBooking } from '@/app/(dashboard)/dashboard/business-center/actions'
import { SERVICE_OPTIONS } from '@/lib/booking-services'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────

interface Room {
  id:            string
  name:          string
  capacity:      number | null
  hourly_rate:   number | null
  half_day_rate: number | null
  full_day_rate: number | null
  amenities:     string[]
}

interface Tenant {
  id:           string
  full_name:    string
  company_name: string | null
}

interface Props {
  rooms:        Room[]
  tenants:      Tenant[]
  open:         boolean
  onOpenChange: (v: boolean) => void
  onSuccess:    () => void
  defaultDate?: string   // 'YYYY-MM-DD'
  defaultHour?: number
}

// ─── Helpers ─────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }

function calcAmount(
  room: Room | undefined,
  startTime: string,
  endTime: string,
  services: string[]
): number {
  if (!room || !startTime || !endTime) return 0
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const durationH = (eh + em / 60) - (sh + sm / 60)
  if (durationH <= 0) return 0

  let base = 0
  if (durationH >= 7 && room.full_day_rate) {
    base = room.full_day_rate
  } else if (durationH >= 4 && room.half_day_rate) {
    base = room.half_day_rate
  } else {
    base = Math.ceil(durationH) * (room.hourly_rate ?? 0)
  }

  const svcTotal = services.reduce((sum, key) => {
    const s = SERVICE_OPTIONS.find((o) => o.key === key)
    return sum + (s?.price ?? 0)
  }, 0)

  return base + svcTotal
}

function calcBookingType(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return 'hourly'
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const durationH = (eh + em / 60) - (sh + sm / 60)
  if (durationH >= 7) return 'يوم كامل'
  if (durationH >= 4) return 'نصف يوم'
  return `${durationH.toFixed(1)} ساعة`
}

// ─── Component ───────────────────────────────────────────────────

export function BookingFormDialog({
  rooms,
  tenants,
  open,
  onOpenChange,
  onSuccess,
  defaultDate,
  defaultHour,
}: Props) {
  const [isPending, startTransition] = useTransition()

  // Form state
  const [roomId,       setRoomId]       = useState('')
  const [date,         setDate]         = useState(defaultDate ?? format(new Date(), 'yyyy-MM-dd'))
  const [startTime,    setStartTime]    = useState(defaultHour ? `${pad(defaultHour)}:00` : '09:00')
  const [endTime,      setEndTime]      = useState(defaultHour ? `${pad(defaultHour + 1)}:00` : '10:00')
  const [guestType,    setGuestType]    = useState<'tenant' | 'visitor'>('tenant')
  const [tenantId,     setTenantId]     = useState('')
  const [visitorName,  setVisitorName]  = useState('')
  const [services,     setServices]     = useState<string[]>([])
  const [notes,        setNotes]        = useState('')
  const [error,        setError]        = useState<string | null>(null)
  const [fieldErrors,  setFieldErrors]  = useState<Record<string, string[]>>({})

  // Sync default values when dialog opens
  useEffect(() => {
    if (open) {
      if (defaultDate) setDate(defaultDate)
      if (defaultHour !== undefined) {
        setStartTime(`${pad(defaultHour)}:00`)
        setEndTime(`${pad(Math.min(defaultHour + 1, 21))}:00`)
      }
    }
  }, [open, defaultDate, defaultHour])

  const selectedRoom = useMemo(() => rooms.find((r) => r.id === roomId), [rooms, roomId])

  const totalAmount = useMemo(
    () => calcAmount(selectedRoom, startTime, endTime, services),
    [selectedRoom, startTime, endTime, services]
  )

  const bookingTypeLbl = useMemo(
    () => calcBookingType(startTime, endTime),
    [startTime, endTime]
  )

  const roomOptions = rooms.map((r) => ({
    value: r.id,
    label: r.name,
    sub:   r.capacity ? `طاقة ${r.capacity} شخص — ${r.hourly_rate} د.إ/ساعة` : undefined,
  }))

  const tenantOptions = tenants.map((t) => ({
    value: t.id,
    label: t.full_name,
    sub:   t.company_name ?? undefined,
  }))

  function toggleService(key: string) {
    setServices((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    )
  }

  function handleClose() {
    if (isPending) return
    setRoomId(''); setDate(format(new Date(), 'yyyy-MM-dd'))
    setStartTime('09:00'); setEndTime('10:00')
    setGuestType('tenant'); setTenantId(''); setVisitorName('')
    setServices([]); setNotes(''); setError(null); setFieldErrors({})
    onOpenChange(false)
  }

  function handleSubmit() {
    setError(null); setFieldErrors({})
    startTransition(async () => {
      const res = await createBooking({
        meeting_room_id: roomId,
        date,
        start_time:      startTime,
        end_time:        endTime,
        tenant_id:       guestType === 'tenant' ? (tenantId || null) : null,
        visitor_name:    guestType === 'visitor' ? (visitorName.trim() || null) : null,
        services,
        notes:           notes.trim() || null,
      })
      if (res.success) {
        toast.success('تم إنشاء الحجز بنجاح')
        handleClose()
        onSuccess()
      } else {
        setError(res.error)
        setFieldErrors(res.fieldErrors)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>حجز جديد</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* ── القاعة ── */}
          <div className="space-y-1.5">
            <Label>القاعة <span className="text-destructive">*</span></Label>
            <Combobox
              options={roomOptions}
              value={roomId}
              onValueChange={setRoomId}
              placeholder="اختر قاعة..."
              searchPlaceholder="بحث عن قاعة..."
              emptyMessage="لا توجد قاعات"
            />
            {fieldErrors.meeting_room_id && (
              <p className="text-xs text-destructive">{fieldErrors.meeting_room_id[0]}</p>
            )}
          </div>

          {/* Room info card */}
          {selectedRoom && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm grid grid-cols-2 gap-x-4 gap-y-1">
              {selectedRoom.capacity && (
                <>
                  <span className="text-muted-foreground">الطاقة</span>
                  <span className="font-medium">{selectedRoom.capacity} شخص</span>
                </>
              )}
              {selectedRoom.hourly_rate && (
                <>
                  <span className="text-muted-foreground">بالساعة</span>
                  <span className="font-medium">{selectedRoom.hourly_rate} د.إ</span>
                </>
              )}
              {selectedRoom.half_day_rate && (
                <>
                  <span className="text-muted-foreground">نصف يوم</span>
                  <span className="font-medium">{selectedRoom.half_day_rate} د.إ</span>
                </>
              )}
              {selectedRoom.full_day_rate && (
                <>
                  <span className="text-muted-foreground">يوم كامل</span>
                  <span className="font-medium">{selectedRoom.full_day_rate} د.إ</span>
                </>
              )}
              {selectedRoom.amenities?.length > 0 && (
                <>
                  <span className="text-muted-foreground">المرافق</span>
                  <span className="font-medium text-xs">{selectedRoom.amenities.join('، ')}</span>
                </>
              )}
            </div>
          )}

          {/* ── التاريخ والوقت ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="booking-date">التاريخ <span className="text-destructive">*</span></Label>
              <Input
                id="booking-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start-time">من <span className="text-destructive">*</span></Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-time">إلى <span className="text-destructive">*</span></Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          {/* ── المستأجر / الزائر ── */}
          <div className="space-y-2">
            <Label>الحاجز <span className="text-destructive">*</span></Label>
            <div className="flex gap-2 rounded-lg border p-0.5 w-fit">
              {(['tenant', 'visitor'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGuestType(t)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    guestType === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'tenant' ? 'مستأجر' : 'زائر خارجي'}
                </button>
              ))}
            </div>

            {guestType === 'tenant' ? (
              <Combobox
                options={tenantOptions}
                value={tenantId}
                onValueChange={setTenantId}
                placeholder="اختر مستأجراً..."
                searchPlaceholder="بحث عن مستأجر..."
                emptyMessage="لا يوجد مستأجرون"
              />
            ) : (
              <Input
                placeholder="اسم الزائر الخارجي..."
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                disabled={isPending}
              />
            )}
            {fieldErrors.tenant_id && (
              <p className="text-xs text-destructive">{fieldErrors.tenant_id[0]}</p>
            )}
          </div>

          {/* ── الخدمات الإضافية ── */}
          <div className="space-y-2">
            <Label>الخدمات الإضافية</Label>
            <div className="grid grid-cols-1 gap-2">
              {SERVICE_OPTIONS.map((svc) => (
                <label
                  key={svc.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    services.includes(svc.key)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-primary"
                    checked={services.includes(svc.key)}
                    onChange={() => toggleService(svc.key)}
                    disabled={isPending}
                  />
                  <span className="text-sm flex-1">{svc.label}</span>
                  <span className="text-sm font-medium text-muted-foreground">+{svc.price} د.إ</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── ملاحظات ── */}
          <div className="space-y-1.5">
            <Label htmlFor="booking-notes">ملاحظات</Label>
            <Textarea
              id="booking-notes"
              placeholder="أي تفاصيل إضافية..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* ── ملخص المبلغ ── */}
          {selectedRoom && totalAmount > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">نوع الحجز</span>
                <span className="font-medium">{bookingTypeLbl}</span>
              </div>
              {services.map((key) => {
                const svc = SERVICE_OPTIONS.find((o) => o.key === key)
                return svc ? (
                  <div key={key} className="flex justify-between text-muted-foreground">
                    <span>{svc.label}</span>
                    <span>+{svc.price} د.إ</span>
                  </div>
                ) : null
              })}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>الإجمالي</span>
                <span className="text-primary">{totalAmount.toLocaleString('ar-AE')} د.إ</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
          )}
        </div>

        <DialogFooter className="flex gap-2 flex-row-reverse pt-2">
          <Button
            onClick={handleSubmit}
            disabled={isPending || !roomId || !date || !startTime || !endTime}
          >
            {isPending ? 'جارٍ الحجز...' : 'تأكيد الحجز'}
          </Button>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
