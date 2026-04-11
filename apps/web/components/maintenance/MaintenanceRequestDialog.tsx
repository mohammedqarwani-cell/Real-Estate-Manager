'use client'

import { useTransition, useState, useRef } from 'react'
import { toast } from 'sonner'
import { ImagePlus, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { createMaintenanceRequest } from '@/app/(dashboard)/dashboard/maintenance/actions'

// ─── Types ──────────────────────────────────────────────────

interface UnitOption {
  id:          string
  unit_number: string
  property:    { id: string; name: string } | null
}

interface MaintenanceRequestDialogProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
  onSuccess:    () => void
  units:        UnitOption[]
}

// ─── Constants ──────────────────────────────────────────────

const CATEGORIES = [
  { value: 'electrical', label: 'كهرباء' },
  { value: 'plumbing',   label: 'سباكة' },
  { value: 'hvac',       label: 'مكيف / تكييف' },
  { value: 'structural', label: 'هيكلي / بنائي' },
  { value: 'cleaning',   label: 'نظافة' },
  { value: 'other',      label: 'أخرى' },
]

const PRIORITIES = [
  { value: 'low',    label: 'منخفضة' },
  { value: 'medium', label: 'متوسطة' },
  { value: 'high',   label: 'عالية' },
  { value: 'urgent', label: 'عاجلة' },
]

// ─── Component ──────────────────────────────────────────────

export function MaintenanceRequestDialog({
  open,
  onOpenChange,
  onSuccess,
  units,
}: MaintenanceRequestDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [unitId, setUnitId]         = useState('')
  const [category, setCategory]     = useState('')
  const [priority, setPriority]     = useState('')
  const [previews, setPreviews]     = useState<string[]>([])
  const [formError, setFormError]   = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const fileInputRef                = useRef<HTMLInputElement>(null)
  const formRef                     = useRef<HTMLFormElement>(null)

  const unitOptions = units.map((u) => ({
    value: u.id,
    label: `وحدة ${u.unit_number}`,
    sub:   u.property?.name ?? '',
  }))

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const urls  = files.map((f) => URL.createObjectURL(f))
    setPreviews((prev) => [...prev, ...urls])
  }

  function removePreview(idx: number) {
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
    // Reset file input so the same file can be re-added
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('unit_id', unitId)
    fd.set('category', category)
    fd.set('priority', priority)

    startTransition(async () => {
      const result = await createMaintenanceRequest({ success: false, error: null, fieldErrors: {} }, fd)
      if (result.success) {
        toast.success('تم تقديم طلب الصيانة بنجاح')
        handleClose()
        onSuccess()
      } else {
        setFormError(result.error)
        setFieldErrors(result.fieldErrors)
        toast.error(result.error ?? 'حدث خطأ')
      }
    })
  }

  function handleClose() {
    onOpenChange(false)
    setUnitId('')
    setCategory('')
    setPriority('')
    setPreviews([])
    setFormError(null)
    setFieldErrors({})
    formRef.current?.reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>تقديم طلب صيانة</DialogTitle>
          <DialogDescription className="sr-only">رفع طلب صيانة جديد مع تحديد الوحدة والنوع والأولوية</DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {/* Unit */}
          <div className="space-y-1.5">
            <Label>الوحدة <span className="text-destructive">*</span></Label>
            <Combobox
              options={unitOptions}
              value={unitId}
              onValueChange={setUnitId}
              placeholder="اختر الوحدة..."
              searchPlaceholder="ابحث عن الوحدة..."
            />
            {fieldErrors?.unit_id && (
              <p className="text-xs text-destructive">{fieldErrors.unit_id[0]}</p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">عنوان المشكلة <span className="text-destructive">*</span></Label>
            <Input id="title" name="title" placeholder="مثال: تسريب مياه في الحمام" />
            {fieldErrors?.title && (
              <p className="text-xs text-destructive">{fieldErrors.title[0]}</p>
            )}
          </div>

          {/* Category + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>نوع المشكلة <span className="text-destructive">*</span></Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر النوع..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors?.category && (
                <p className="text-xs text-destructive">{fieldErrors.category[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>الأولوية <span className="text-destructive">*</span></Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الأولوية..." />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors?.priority && (
                <p className="text-xs text-destructive">{fieldErrors.priority[0]}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">وصف المشكلة <span className="text-destructive">*</span></Label>
            <Textarea
              id="description"
              name="description"
              placeholder="اشرح المشكلة بالتفصيل..."
              rows={3}
            />
            {fieldErrors?.description && (
              <p className="text-xs text-destructive">{fieldErrors.description[0]}</p>
            )}
          </div>

          {/* Images */}
          <div className="space-y-1.5">
            <Label>صور المشكلة (اختياري)</Label>
            <div className="flex flex-wrap gap-2">
              {previews.map((url, idx) => (
                <div key={idx} className="relative h-20 w-20 rounded-lg overflow-hidden border">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePreview(idx)}
                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-[10px]">إضافة</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              name="images"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          {formError && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {formError}
            </p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>إلغاء</Button>
            <Button
              type="submit"
              disabled={isPending || !unitId || !category || !priority}
            >
              {isPending ? 'جارٍ الإرسال...' : 'تقديم الطلب'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
