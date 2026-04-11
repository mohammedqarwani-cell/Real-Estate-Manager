'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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
import { Combobox } from '@/components/ui/combobox'
import { createContract } from '@/app/(dashboard)/dashboard/contracts/actions'
import type { Tenant, Unit, Property } from '@repo/types'

const formSchema = z.object({
  unit_id: z.string().min(1, 'يرجى اختيار الوحدة'),
  tenant_id: z.string().min(1, 'يرجى اختيار المستأجر'),
  start_date: z.string().min(1, 'تاريخ البداية مطلوب'),
  end_date: z.string().min(1, 'تاريخ النهاية مطلوب'),
  monthly_rent: z.string().min(1, 'الإيجار الشهري مطلوب'),
  security_deposit: z.string().optional(),
  payment_day: z.string().optional(),
  payment_cycle: z.enum(['monthly', 'quarterly', 'annually']),
  terms: z.string().optional(),
}).refine(
  (d) => !d.start_date || !d.end_date || new Date(d.end_date) > new Date(d.start_date),
  { message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية', path: ['end_date'] }
)

type FormValues = z.infer<typeof formSchema>

type UnitWithProperty = Unit & { property: Pick<Property, 'id' | 'name'> }

interface ContractFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  availableUnits: UnitWithProperty[]
  tenants: Tenant[]
}

export function ContractFormDialog({
  open,
  onOpenChange,
  onSuccess,
  availableUnits,
  tenants,
}: ContractFormDialogProps) {
  const [isPending, startTransition] = useTransition()
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
      unit_id: '',
      tenant_id: '',
      start_date: '',
      end_date: '',
      monthly_rent: '',
      security_deposit: '0',
      payment_day: '1',
      payment_cycle: 'monthly',
      terms: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        unit_id: '',
        tenant_id: '',
        start_date: '',
        end_date: '',
        monthly_rent: '',
        security_deposit: '0',
        payment_day: '1',
        payment_cycle: 'monthly',
        terms: '',
      })
      setServerError(null)
    }
  }, [open, reset])

  function onSubmit(values: FormValues) {
    setServerError(null)
    const formData = new FormData()
    formData.append('unit_id', values.unit_id)
    formData.append('tenant_id', values.tenant_id)
    formData.append('start_date', values.start_date)
    formData.append('end_date', values.end_date)
    formData.append('monthly_rent', values.monthly_rent)
    formData.append('security_deposit', values.security_deposit || '0')
    formData.append('payment_day', values.payment_day || '1')
    formData.append('payment_cycle', values.payment_cycle)
    if (values.terms) formData.append('terms', values.terms)

    startTransition(async () => {
      const result = await createContract({ success: false, error: null, fieldErrors: {} }, formData)
      if (result.success) {
        toast.success('تم إنشاء العقد بنجاح')
        onOpenChange(false)
        onSuccess?.()
      } else {
        setServerError(result.error)
        if (result.error) toast.error(result.error)
      }
    })
  }

  const unitOptions = availableUnits.map((u) => ({
    value: u.id,
    label: `وحدة ${u.unit_number}`,
    sub: (u as any).property?.name ?? '',
  }))

  const tenantOptions = tenants.map((t) => ({
    value: t.id,
    label: t.full_name,
    sub: t.phone ?? t.email ?? '',
  }))

  const paymentCycleValue = watch('payment_cycle')
  const unitIdValue = watch('unit_id')
  const tenantIdValue = watch('tenant_id')

  // Auto-fill monthly_rent from selected unit
  useEffect(() => {
    if (unitIdValue) {
      const unit = availableUnits.find((u) => u.id === unitIdValue)
      if (unit?.monthly_rent) {
        setValue('monthly_rent', String(unit.monthly_rent))
      }
    }
  }, [unitIdValue, availableUnits, setValue])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>إنشاء عقد إيجار جديد</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* الوحدة */}
          <div className="space-y-1.5">
            <Label>الوحدة *</Label>
            <Combobox
              options={unitOptions}
              value={unitIdValue}
              onValueChange={(v) => setValue('unit_id', v, { shouldValidate: true })}
              placeholder="اختر الوحدة..."
              searchPlaceholder="بحث بالوحدة أو العقار..."
              emptyMessage="لا توجد وحدات متاحة"
            />
            {errors.unit_id && <p className="text-xs text-destructive">{errors.unit_id.message}</p>}
          </div>

          {/* المستأجر */}
          <div className="space-y-1.5">
            <Label>المستأجر *</Label>
            <Combobox
              options={tenantOptions}
              value={tenantIdValue}
              onValueChange={(v) => setValue('tenant_id', v, { shouldValidate: true })}
              placeholder="اختر المستأجر..."
              searchPlaceholder="بحث بالاسم أو الهاتف..."
              emptyMessage="لا يوجد مستأجرون"
            />
            {errors.tenant_id && <p className="text-xs text-destructive">{errors.tenant_id.message}</p>}
          </div>

          {/* تاريخ البداية والنهاية */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">تاريخ البداية *</Label>
              <Input id="start_date" type="date" {...register('start_date')} />
              {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">تاريخ النهاية *</Label>
              <Input id="end_date" type="date" {...register('end_date')} />
              {errors.end_date && <p className="text-xs text-destructive">{errors.end_date.message}</p>}
            </div>
          </div>

          {/* الإيجار الشهري + مبلغ التأمين */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="monthly_rent">الإيجار الشهري (د.إ) *</Label>
              <Input id="monthly_rent" type="number" min="0" {...register('monthly_rent')} placeholder="5000" />
              {errors.monthly_rent && <p className="text-xs text-destructive">{errors.monthly_rent.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="security_deposit">مبلغ التأمين (د.إ)</Label>
              <Input id="security_deposit" type="number" min="0" {...register('security_deposit')} placeholder="0" />
            </div>
          </div>

          {/* دورة الدفع + يوم الدفع */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>دورة الدفع</Label>
              <Select
                value={paymentCycleValue}
                onValueChange={(v) => setValue('payment_cycle', v as FormValues['payment_cycle'], { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر دورة الدفع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">شهري</SelectItem>
                  <SelectItem value="quarterly">ربعي</SelectItem>
                  <SelectItem value="annually">سنوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment_day">يوم الدفع من الشهر</Label>
              <Input id="payment_day" type="number" min="1" max="31" {...register('payment_day')} placeholder="1" />
            </div>
          </div>

          {/* الشروط */}
          <div className="space-y-1.5">
            <Label htmlFor="terms">شروط العقد</Label>
            <Textarea id="terms" {...register('terms')} placeholder="أي شروط أو ملاحظات خاصة..." rows={3} />
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
              إنشاء العقد
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
