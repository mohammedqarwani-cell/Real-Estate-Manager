'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Upload, X } from 'lucide-react'

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
import { createProperty, updateProperty } from '@/app/(dashboard)/dashboard/properties/actions'
import type { Property } from '@repo/types'

// ─── Schema ────────────────────────────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(2, 'اسم العقار يجب أن يكون حرفين على الأقل'),
  type: z.enum(['residential', 'commercial', 'business_center', 'mixed']),
  address: z.string().min(5, 'العنوان يجب أن يكون 5 أحرف على الأقل'),
  city: z.string().optional(),
  country: z.string().min(2, 'الدولة مطلوبة'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'under_maintenance']),
})

type FormValues = z.infer<typeof formSchema>

interface PropertyFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  property?: Property | null
}

export function PropertyFormDialog({ open, onOpenChange, property }: PropertyFormDialogProps) {
  const isEdit = !!property
  const [isPending, startTransition] = useTransition()
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

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
      name: '',
      type: 'residential',
      address: '',
      city: '',
      country: 'المملكة العربية السعودية',
      description: '',
      status: 'active',
    },
  })

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      reset({
        name: property?.name ?? '',
        type: property?.type ?? 'residential',
        address: property?.address ?? '',
        city: property?.city ?? '',
        country: property?.country ?? 'المملكة العربية السعودية',
        description: property?.description ?? '',
        status: property?.status ?? 'active',
      })
      setImagePreview(property?.images?.[0] ?? null)
      setImageFile(null)
      setServerError(null)
    }
  }, [open, property, reset])

  function onSubmit(values: FormValues) {
    setServerError(null)

    const formData = new FormData()
    Object.entries(values).forEach(([k, v]) => {
      if (v != null) formData.append(k, v)
    })
    if (imageFile) formData.append('image', imageFile)

    startTransition(async () => {
      const action = isEdit
        ? updateProperty.bind(null, property!.id)
        : createProperty

      const result = await action({ success: false, error: null, fieldErrors: {} }, formData)

      if (result.success) {
        toast.success(isEdit ? 'تم تحديث العقار بنجاح' : 'تم إضافة العقار بنجاح')
        onOpenChange(false)
      } else {
        setServerError(result.error)
        if (result.error) toast.error(result.error)
      }
    })
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const typeValue = watch('type')
  const statusValue = watch('status')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'تعديل العقار' : 'إضافة عقار جديد'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">اسم العقار *</Label>
            <Input id="name" {...register('name')} placeholder="مثال: برج الياسمين" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>نوع العقار *</Label>
            <Select
              value={typeValue}
              onValueChange={(v) => setValue('type', v as FormValues['type'], { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="residential">سكني</SelectItem>
                <SelectItem value="commercial">تجاري</SelectItem>
                <SelectItem value="business_center">بيزنس سنتر</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="address">العنوان *</Label>
            <Input id="address" {...register('address')} placeholder="مثال: شارع الملك فهد، الرياض" />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>

          {/* City + Country */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">المدينة</Label>
              <Input id="city" {...register('city')} placeholder="الرياض" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">الدولة *</Label>
              <Input id="country" {...register('country')} placeholder="المملكة العربية السعودية" />
              {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>الحالة *</Label>
            <Select
              value={statusValue}
              onValueChange={(v) => setValue('status', v as FormValues['status'], { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
                <SelectItem value="under_maintenance">تحت الصيانة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">الوصف</Label>
            <Textarea id="description" {...register('description')} placeholder="وصف مختصر للعقار..." rows={3} />
          </div>

          {/* Image Upload */}
          <div className="space-y-1.5">
            <Label>صورة العقار</Label>
            {imagePreview ? (
              <div className="relative w-full h-40 rounded-md overflow-hidden border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="صورة العقار" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImagePreview(null); setImageFile(null) }}
                  className="absolute top-2 left-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-input rounded-md cursor-pointer hover:bg-muted/30 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">اضغط لرفع صورة</span>
                <span className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            )}
          </div>

          {/* Server Error */}
          {serverError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{serverError}</p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'حفظ التعديلات' : 'إضافة العقار'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
