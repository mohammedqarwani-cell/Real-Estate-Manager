'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Upload, X, ImagePlus } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createUnit, updateUnit } from '@/app/(dashboard)/dashboard/properties/[id]/units/actions'
import type { Unit } from '@repo/types'

// ─── Schema ────────────────────────────────────────────────────────────────

const formSchema = z.object({
  unit_number: z.string().min(1, 'رقم الوحدة مطلوب'),
  floor: z.string().optional(),
  type: z
    .enum(['apartment', 'office', 'retail', 'studio', 'villa', 'warehouse', 'none'])
    .optional(),
  area: z.string().optional(),
  monthly_rent: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface UnitFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  unit?: Unit | null
}

// ─── Image Preview Item ────────────────────────────────────────────────────

function ImagePreviewItem({
  src,
  onRemove,
}: {
  src: string
  onRemove: () => void
}) {
  return (
    <div className="relative h-20 w-20 rounded-md overflow-hidden border bg-muted shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

export function UnitFormDialog({
  open,
  onOpenChange,
  propertyId,
  unit,
}: UnitFormDialogProps) {
  const isEdit = !!unit
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  // Image state: new files + previews + existing URLs
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      unit_number: '',
      floor: '',
      type: 'none',
      area: '',
      monthly_rent: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        unit_number: unit?.unit_number ?? '',
        floor: unit?.floor != null ? String(unit.floor) : '',
        type: unit?.type ?? 'none',
        area: unit?.area != null ? String(unit.area) : '',
        monthly_rent: unit?.monthly_rent != null ? String(unit.monthly_rent) : '',
        notes: unit?.notes ?? '',
      })
      setExistingImages(unit?.images ?? [])
      setNewFiles([])
      setNewPreviews([])
      setServerError(null)
    }
  }, [open, unit, reset])

  function handleImageAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setNewFiles((prev) => [...prev, ...files])
    setNewPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))])
    // reset input so same file can be re-added
    e.target.value = ''
  }

  function removeExisting(idx: number) {
    setExistingImages((prev) => prev.filter((_, i) => i !== idx))
  }

  function removeNew(idx: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx))
    setNewPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  function onSubmit(values: FormValues) {
    setServerError(null)

    const formData = new FormData()
    formData.append('unit_number', values.unit_number)
    if (values.floor) formData.append('floor', values.floor)
    if (values.type && values.type !== 'none') formData.append('type', values.type)
    if (values.area) formData.append('area', values.area)
    if (values.monthly_rent) formData.append('monthly_rent', values.monthly_rent)
    if (values.notes) formData.append('notes', values.notes)

    for (const file of newFiles) {
      formData.append('images', file)
    }

    startTransition(async () => {
      const action = isEdit
        ? updateUnit.bind(null, unit!.id, propertyId)
        : createUnit.bind(null, propertyId)

      const result = await action({ success: false, error: null, fieldErrors: {} }, formData)

      if (result.success) {
        toast.success(isEdit ? 'تم تحديث الوحدة بنجاح' : 'تم إضافة الوحدة بنجاح')
        onOpenChange(false)
      } else {
        setServerError(result.error)
        if (result.error) toast.error(result.error)
      }
    })
  }

  const typeValue = watch('type')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'تعديل الوحدة' : 'إضافة وحدة جديدة'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Unit Number */}
          <div className="space-y-1.5">
            <Label htmlFor="unit_number">رقم الوحدة *</Label>
            <Input
              id="unit_number"
              {...register('unit_number')}
              placeholder="مثال: 101 أو A-3"
            />
            {errors.unit_number && (
              <p className="text-xs text-destructive">{errors.unit_number.message}</p>
            )}
          </div>

          {/* Floor + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="floor">الطابق</Label>
              <Input
                id="floor"
                type="number"
                {...register('floor')}
                placeholder="مثال: 3"
              />
            </div>
            <div className="space-y-1.5">
              <Label>نوع الوحدة</Label>
              <Select
                value={typeValue ?? ''}
                onValueChange={(v) => setValue('type', v as FormValues['type'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">غير محدد</SelectItem>
                  <SelectItem value="apartment">شقة</SelectItem>
                  <SelectItem value="office">مكتب</SelectItem>
                  <SelectItem value="retail">محل تجاري</SelectItem>
                  <SelectItem value="studio">استوديو</SelectItem>
                  <SelectItem value="villa">فيلا</SelectItem>
                  <SelectItem value="warehouse">مستودع</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Area + Monthly Rent */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="area">المساحة (م²)</Label>
              <Input
                id="area"
                type="number"
                step="0.01"
                {...register('area')}
                placeholder="مثال: 120"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monthly_rent">الإيجار الشهري (د.إ)</Label>
              <Input
                id="monthly_rent"
                type="number"
                step="0.01"
                {...register('monthly_rent')}
                placeholder="مثال: 5000"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="أي ملاحظات إضافية..."
              rows={2}
            />
          </div>

          {/* Images */}
          <div className="space-y-2">
            <Label>صور الوحدة</Label>

            {/* Preview Grid */}
            {(existingImages.length > 0 || newPreviews.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {existingImages.map((src, i) => (
                  <ImagePreviewItem
                    key={`existing-${i}`}
                    src={src}
                    onRemove={() => removeExisting(i)}
                  />
                ))}
                {newPreviews.map((src, i) => (
                  <ImagePreviewItem
                    key={`new-${i}`}
                    src={src}
                    onRemove={() => removeNew(i)}
                  />
                ))}
              </div>
            )}

            {/* Upload Button */}
            <label className="flex items-center gap-2 w-full px-3 py-2.5 border-2 border-dashed border-input rounded-md cursor-pointer hover:bg-muted/30 transition-colors text-sm text-muted-foreground">
              <ImagePlus className="h-4 w-4 shrink-0" />
              <span>اضغط لإضافة صورة (يمكن اختيار متعددة)</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageAdd}
              />
            </label>
          </div>

          {/* Server Error */}
          {serverError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {serverError}
            </p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'حفظ التعديلات' : 'إضافة الوحدة'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
