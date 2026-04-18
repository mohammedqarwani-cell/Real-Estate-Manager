'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { createMeetingRoom, updateMeetingRoom } from '@/app/(dashboard)/dashboard/bookings/actions'

// ─── Types ──────────────────────────────────────────────────

interface Property { id: string; name: string }

interface Room {
  id: string; name: string; capacity: number | null
  hourly_rate: number | null; half_day_rate: number | null; full_day_rate: number | null
  status: string; description: string | null
  property: Property | null
}

interface MeetingRoomFormDialogProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
  onSuccess:    () => void
  room:         Room | null
  properties:   Property[]
}

// ─── Component ──────────────────────────────────────────────

export function MeetingRoomFormDialog({
  open, onOpenChange, onSuccess, room, properties,
}: MeetingRoomFormDialogProps) {
  const [isPending, startTransition] = useTransition()
  const isEdit = !!room

  const [propertyId,   setPropertyId]   = useState(room?.property?.id ?? '')
  const [name,         setName]         = useState(room?.name ?? '')
  const [capacity,     setCapacity]     = useState(room?.capacity != null ? String(room.capacity) : '')
  const [hourlyRate,   setHourlyRate]   = useState(room?.hourly_rate != null ? String(room.hourly_rate) : '')
  const [halfDayRate,  setHalfDayRate]  = useState(room?.half_day_rate != null ? String(room.half_day_rate) : '')
  const [fullDayRate,  setFullDayRate]  = useState(room?.full_day_rate != null ? String(room.full_day_rate) : '')
  const [description,  setDescription]  = useState(room?.description ?? '')
  const [status,       setStatus]       = useState(room?.status ?? 'available')
  const [formError,    setFormError]    = useState<string | null>(null)

  const propOptions = properties.map((p) => ({ value: p.id, label: p.name }))

  function handleClose() { onOpenChange(false); setFormError(null) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!propertyId) { setFormError('يرجى اختيار العقار'); return }
    if (!name.trim()) { setFormError('اسم القاعة مطلوب'); return }

    const fd = new FormData()
    fd.set('property_id',   propertyId)
    fd.set('name',          name.trim())
    fd.set('capacity',      capacity)
    fd.set('hourly_rate',   hourlyRate)
    fd.set('half_day_rate', halfDayRate)
    fd.set('full_day_rate', fullDayRate)
    fd.set('description',   description)
    fd.set('status',        status)

    startTransition(async () => {
      const init = { success: false, error: null, fieldErrors: {} }
      const result = isEdit
        ? await updateMeetingRoom(room!.id, init, fd)
        : await createMeetingRoom(init, fd)

      if (result.success) {
        toast.success(isEdit ? 'تم تحديث القاعة' : 'تم إضافة القاعة بنجاح')
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
          <DialogTitle>{isEdit ? 'تعديل القاعة' : 'إضافة قاعة جديدة'}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? 'تعديل بيانات قاعة الاجتماعات' : 'إضافة قاعة اجتماعات جديدة'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Property */}
          <div className="space-y-1.5">
            <Label>العقار <span className="text-destructive">*</span></Label>
            <Combobox
              options={propOptions}
              value={propertyId}
              onValueChange={setPropertyId}
              placeholder="اختر العقار..."
              searchPlaceholder="ابحث عن العقار..."
            />
          </div>

          {/* Name + Capacity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="room_name">اسم القاعة <span className="text-destructive">*</span></Label>
              <Input
                id="room_name"
                placeholder="مثال: قاعة الياسمين"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capacity">السعة (أشخاص)</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                placeholder="10"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>

          {/* Rates */}
          <div className="space-y-1.5">
            <Label>الأسعار (د.إ)</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground text-center">ساعي</p>
                <Input
                  type="number" min="0" step="0.01" placeholder="0"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground text-center">نصف يوم</p>
                <Input
                  type="number" min="0" step="0.01" placeholder="0"
                  value={halfDayRate}
                  onChange={(e) => setHalfDayRate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground text-center">يوم كامل</p>
                <Input
                  type="number" min="0" step="0.01" placeholder="0"
                  value={fullDayRate}
                  onChange={(e) => setFullDayRate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>الحالة</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">متاحة</SelectItem>
                <SelectItem value="unavailable">غير متاحة</SelectItem>
                <SelectItem value="maintenance">صيانة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">وصف (اختياري)</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="مرافق القاعة، المعدات المتاحة..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {formError && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{formError}</p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>إلغاء</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'جارٍ الحفظ...' : isEdit ? 'حفظ التغييرات' : 'إضافة القاعة'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
