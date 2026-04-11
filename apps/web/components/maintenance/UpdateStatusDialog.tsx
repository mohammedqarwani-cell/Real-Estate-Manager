'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateMaintenanceRequest } from '@/app/(dashboard)/dashboard/maintenance/actions'

// ─── Types ──────────────────────────────────────────────────

interface Technician {
  id:        string
  full_name: string | null
}

interface MaintenanceItem {
  id:          string
  title:       string
  status:      string
  priority:    string
  category:    string | null
  assigned_to: string | null
  actual_cost: number | null
  notes:       string | null
  unit?:       { unit_number: string; property?: { name: string } | null } | null
}

interface UpdateStatusDialogProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
  onSuccess:    () => void
  request:      MaintenanceItem | null
  technicians:  Technician[]
}

// ─── Constants ──────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'open',        label: 'مفتوح' },
  { value: 'in_progress', label: 'قيد التنفيذ' },
  { value: 'completed',   label: 'مكتمل' },
  { value: 'cancelled',   label: 'ملغي' },
]

const PRIORITY_LABELS: Record<string, string> = {
  low:    'منخفضة',
  medium: 'متوسطة',
  high:   'عالية',
  urgent: 'عاجلة',
}

const CATEGORY_LABELS: Record<string, string> = {
  plumbing:   'سباكة',
  electrical: 'كهرباء',
  hvac:       'مكيف',
  structural: 'هيكلي',
  cleaning:   'نظافة',
  other:      'أخرى',
}

// ─── Component ──────────────────────────────────────────────

export function UpdateStatusDialog({
  open,
  onOpenChange,
  onSuccess,
  request,
  technicians,
}: UpdateStatusDialogProps) {
  const [isPending, startTransition] = useTransition()

  const [status,     setStatus]     = useState(request?.status      ?? 'open')
  const [assignedTo, setAssignedTo] = useState(request?.assigned_to ?? '')
  const [actualCost, setActualCost] = useState(
    request?.actual_cost != null ? String(request.actual_cost) : ''
  )
  const [notes, setNotes] = useState(request?.notes ?? '')

  // Sync state when request changes
  if (request) {
    // Use key prop on Dialog to reset instead of syncing here
  }

  function handleClose() {
    onOpenChange(false)
  }

  function handleSubmit() {
    if (!request) return
    startTransition(async () => {
      const result = await updateMaintenanceRequest(request.id, {
        status,
        assigned_to: assignedTo || null,
        actual_cost: actualCost ? parseFloat(actualCost) : null,
        notes:       notes || null,
      })
      if (result.success) {
        toast.success('تم تحديث الطلب بنجاح')
        handleClose()
        onSuccess()
      } else {
        toast.error(result.error ?? 'حدث خطأ')
      }
    })
  }

  if (!request) return null

  const unitLabel = request.unit
    ? `${request.unit.property?.name ?? ''} — وحدة ${request.unit.unit_number}`
    : '—'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تحديث طلب الصيانة</DialogTitle>
          <DialogDescription className="sr-only">تعديل حالة الطلب وتعيين الفني وإدخال التكلفة</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Request summary */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
            <p className="font-medium">{request.title}</p>
            <p className="text-muted-foreground">{unitLabel}</p>
            <div className="flex items-center gap-3 pt-1 text-xs">
              <span className="text-muted-foreground">
                النوع: {CATEGORY_LABELS[request.category ?? ''] ?? request.category ?? '—'}
              </span>
              <span className="text-muted-foreground">
                الأولوية: {PRIORITY_LABELS[request.priority] ?? request.priority}
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>الحالة</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assign Technician */}
          <div className="space-y-1.5">
            <Label>تعيين فني</Label>
            <Select value={assignedTo || 'none'} onValueChange={(v) => setAssignedTo(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue>
                  {assignedTo
                    ? (technicians.find((t) => t.id === assignedTo)?.full_name ?? 'فني غير معروف')
                    : '— غير محدد —'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— غير محدد —</SelectItem>
                {technicians
                  .filter((t) => t.full_name)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actual Cost */}
          <div className="space-y-1.5">
            <Label htmlFor="actual_cost">تكلفة الإصلاح (د.إ)</Label>
            <Input
              id="actual_cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={actualCost}
              onChange={(e) => setActualCost(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">ملاحظات الإغلاق</Label>
            <Textarea
              id="notes"
              placeholder="ملاحظات إضافية أو تفاصيل الإصلاح..."
              rows={3}
              value={notes ?? ''}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
