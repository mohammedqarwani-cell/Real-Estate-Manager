'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Upload, X, FileText } from 'lucide-react'
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
import { createTenant, updateTenant } from '@/app/(dashboard)/dashboard/tenants/actions'
import type { Tenant } from '@repo/types'

const formSchema = z.object({
  full_name: z.string().min(1, 'الاسم الكامل مطلوب'),
  email: z.string().email('بريد إلكتروني غير صالح').or(z.literal('')).optional(),
  phone: z.string().optional(),
  national_id: z.string().optional(),
  company_name: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive', 'blacklisted']),
})

type FormValues = z.infer<typeof formSchema>

interface TenantFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  tenant?: Tenant | null
}

export function TenantFormDialog({ open, onOpenChange, onSuccess, tenant }: TenantFormDialogProps) {
  const isEdit = !!tenant
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [docFiles, setDocFiles] = useState<File[]>([])

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
      full_name: '',
      email: '',
      phone: '',
      national_id: '',
      company_name: '',
      address: '',
      notes: '',
      status: 'active',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        full_name: tenant?.full_name ?? '',
        email: tenant?.email ?? '',
        phone: tenant?.phone ?? '',
        national_id: tenant?.national_id ?? '',
        company_name: tenant?.company_name ?? '',
        address: tenant?.address ?? '',
        notes: tenant?.notes ?? '',
        status: tenant?.status ?? 'active',
      })
      setDocFiles([])
      setServerError(null)
    }
  }, [open, tenant, reset])

  function onSubmit(values: FormValues) {
    setServerError(null)
    const formData = new FormData()
    formData.append('full_name', values.full_name)
    if (values.email)        formData.append('email', values.email)
    if (values.phone)        formData.append('phone', values.phone)
    if (values.national_id)  formData.append('national_id', values.national_id)
    if (values.company_name) formData.append('company_name', values.company_name)
    if (values.address)      formData.append('address', values.address)
    if (values.notes)        formData.append('notes', values.notes)
    formData.append('status', values.status)
    for (const f of docFiles) formData.append('documents', f)

    startTransition(async () => {
      const action = isEdit
        ? updateTenant.bind(null, tenant!.id)
        : createTenant
      const result = await action({ success: false, error: null, fieldErrors: {} }, formData)
      if (result.success) {
        toast.success(isEdit ? 'تم تحديث بيانات المستأجر' : 'تم إضافة المستأجر بنجاح')
        onOpenChange(false)
        onSuccess?.()
      } else {
        setServerError(result.error)
        if (result.error) toast.error(result.error)
      }
    })
  }

  const statusValue = watch('status')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'تعديل بيانات المستأجر' : 'إضافة مستأجر جديد'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* الاسم الكامل */}
          <div className="space-y-1.5">
            <Label htmlFor="full_name">الاسم الكامل *</Label>
            <Input id="full_name" {...register('full_name')} placeholder="اسم المستأجر" />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
          </div>

          {/* الهاتف + رقم الهوية */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input id="phone" {...register('phone')} placeholder="+971 50 XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="national_id">رقم الهوية</Label>
              <Input id="national_id" {...register('national_id')} placeholder="784-XXXX-XXXXXXX-X" />
            </div>
          </div>

          {/* البريد الإلكتروني */}
          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" {...register('email')} placeholder="example@email.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          {/* الشركة + الحالة */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="company_name">الشركة</Label>
              <Input id="company_name" {...register('company_name')} placeholder="اسم الشركة (اختياري)" />
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
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
                  <SelectItem value="blacklisted">محظور</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* العنوان */}
          <div className="space-y-1.5">
            <Label htmlFor="address">العنوان</Label>
            <Input id="address" {...register('address')} placeholder="العنوان التفصيلي" />
          </div>

          {/* ملاحظات */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea id="notes" {...register('notes')} placeholder="أي ملاحظات..." rows={2} />
          </div>

          {/* المستندات */}
          <div className="space-y-2">
            <Label>المستندات (هوية / جواز سفر)</Label>
            {docFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {docFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border bg-muted/40 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate max-w-[140px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setDocFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 w-full px-3 py-2.5 border-2 border-dashed border-input rounded-md cursor-pointer hover:bg-muted/30 transition-colors text-sm text-muted-foreground">
              <Upload className="h-4 w-4 shrink-0" />
              <span>رفع مستندات (PDF / صور)</span>
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length) setDocFiles(prev => [...prev, ...files])
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          {serverError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{serverError}</p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'حفظ التعديلات' : 'إضافة المستأجر'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
