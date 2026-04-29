'use client'

import { useEffect, useState, useTransition, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Loader2, CalendarDays, RefreshCw } from 'lucide-react'
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

// ─── خيارات عدد الدفعات ────────────────────────────────────────────────────

const PAYMENT_COUNT_OPTIONS = [
  { value: '1',      label: 'دفعة واحدة (كامل المبلغ)' },
  { value: '2',      label: 'دفعتان (كل 6 أشهر)' },
  { value: '3',      label: '3 دفعات (كل 4 أشهر)' },
  { value: '4',      label: '4 دفعات (كل 3 أشهر)' },
  { value: '12',     label: '12 دفعة (شهري)' },
  { value: 'custom', label: 'مخصص...' },
]

// ─── Schema ────────────────────────────────────────────────────────────────

const formSchema = z.object({
  unit_id:            z.string().min(1, 'يرجى اختيار الوحدة'),
  tenant_id:          z.string().min(1, 'يرجى اختيار المستأجر'),
  contract_type:      z.enum(['full_time', 'part_time']),
  start_date:         z.string().min(1, 'تاريخ البداية مطلوب'),
  end_date:           z.string().min(1, 'تاريخ النهاية مطلوب'),
  total_amount:       z.string().min(1, 'إجمالي الإيجار مطلوب'),
  security_deposit:   z.string().optional(),
  payment_count_key:  z.string().min(1, 'يرجى اختيار طريقة الدفع'),
  custom_count:       z.string().optional(),
  terms:              z.string().optional(),
}).refine(
  (d) => !d.start_date || !d.end_date || new Date(d.end_date) > new Date(d.start_date),
  { message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية', path: ['end_date'] }
).refine(
  (d) => {
    if (d.payment_count_key !== 'custom') return true
    const n = parseInt(d.custom_count ?? '0')
    return n >= 1 && n <= 365
  },
  { message: 'عدد الدفعات المخصص يجب أن يكون بين 1 و 365', path: ['custom_count'] }
)

type FormValues = z.infer<typeof formSchema>
type UnitWithProperty = Unit & { property: Pick<Property, 'id' | 'name'> }

// صف الجدول القابل للتعديل
interface ScheduleRow {
  index:    number
  due_date: string   // YYYY-MM-DD
  amount:   number
}

interface ContractFormDialogProps {
  open:           boolean
  onOpenChange:   (open: boolean) => void
  onSuccess?:     () => void
  availableUnits: UnitWithProperty[]
  tenants:        Tenant[]
}

// ─── حساب تواريخ الدفعات ──────────────────────────────────────────────────

function computeDefaultSchedule(
  startDate: string,
  endDate: string,
  paymentCount: number,
  paymentAmount: number
): ScheduleRow[] {
  if (!startDate || !endDate || paymentCount < 1 || paymentAmount <= 0) return []
  const start = new Date(startDate)
  const end   = new Date(endDate)
  if (end <= start) return []

  const totalMs    = end.getTime() - start.getTime()
  const intervalMs = totalMs / paymentCount

  return Array.from({ length: paymentCount }, (_, i) => {
    const d = new Date(start.getTime() + intervalMs * i)
    return {
      index:    i + 1,
      due_date: d.toISOString().split('T')[0],
      amount:   paymentAmount,
    }
  })
}

// ─── Main Component ────────────────────────────────────────────────────────

export function ContractFormDialog({
  open,
  onOpenChange,
  onSuccess,
  availableUnits,
  tenants,
}: ContractFormDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([])

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
      unit_id:           '',
      tenant_id:         '',
      contract_type:     'full_time' as const,
      start_date:        '',
      end_date:          '',
      total_amount:      '',
      security_deposit:  '0',
      payment_count_key: '1',
      custom_count:      '',
      terms:             '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        unit_id:           '',
        tenant_id:         '',
        contract_type:     'full_time',
        start_date:        '',
        end_date:          '',
        total_amount:      '',
        security_deposit:  '0',
        payment_count_key: '1',
        custom_count:      '',
        terms:             '',
      })
      setServerError(null)
      setScheduleRows([])
    }
  }, [open, reset])

  // ─── Watched values ──────────────────────────────────────────────────────
  const unitIdValue     = watch('unit_id')
  const totalAmountStr  = watch('total_amount')
  const startDateStr    = watch('start_date')
  const endDateStr      = watch('end_date')
  const paymentCountKey = watch('payment_count_key')
  const customCountStr  = watch('custom_count')

  // ─── Auto-fill from unit ─────────────────────────────────────────────────
  useEffect(() => {
    if (unitIdValue) {
      const unit = availableUnits.find((u) => u.id === unitIdValue)
      if (unit?.monthly_rent) {
        setValue('total_amount', String(unit.monthly_rent * 12))
      }
    }
  }, [unitIdValue, availableUnits, setValue])

  // ─── Derived values ──────────────────────────────────────────────────────
  const paymentCount = useMemo(() => {
    if (paymentCountKey === 'custom') {
      const n = parseInt(customCountStr ?? '0')
      return isNaN(n) || n < 1 ? 0 : n
    }
    return parseInt(paymentCountKey) || 0
  }, [paymentCountKey, customCountStr])

  const totalAmount   = parseFloat(totalAmountStr) || 0
  const paymentAmount = paymentCount > 0 ? totalAmount / paymentCount : 0

  // ─── إعادة توليد الجدول عند تغيير المعطيات الأساسية ───────────────────────
  const defaultSchedule = useMemo(
    () => computeDefaultSchedule(startDateStr, endDateStr, paymentCount, paymentAmount),
    [startDateStr, endDateStr, paymentCount, paymentAmount]
  )

  // عند تغيير أي معطى أساسي → أعد بناء الجدول (مع إبقاء التعديلات اليدوية إذا أمكن)
  useEffect(() => {
    setScheduleRows(defaultSchedule)
  }, [defaultSchedule])

  // ─── تعديل صف في الجدول ──────────────────────────────────────────────────
  function updateRow(index: number, field: 'due_date' | 'amount', value: string) {
    setScheduleRows((prev) =>
      prev.map((row) =>
        row.index === index
          ? { ...row, [field]: field === 'amount' ? parseFloat(value) || 0 : value }
          : row
      )
    )
  }

  // مجموع المبالغ المُدخلة
  const scheduleTotalAmount = scheduleRows.reduce((s, r) => s + r.amount, 0)
  const amountMismatch = scheduleRows.length > 0 && Math.abs(scheduleTotalAmount - totalAmount) > 0.5

  // ─── Submit ──────────────────────────────────────────────────────────────
  function buildFormData(values: FormValues, status: 'active' | 'draft'): FormData {
    const formData = new FormData()
    formData.append('unit_id',          values.unit_id)
    formData.append('tenant_id',        values.tenant_id)
    formData.append('contract_type',    values.contract_type)
    formData.append('status',           status)
    formData.append('start_date',       values.start_date)
    formData.append('end_date',         values.end_date)
    formData.append('total_amount',     totalAmount.toString())
    formData.append('payment_count',    paymentCount.toString())
    formData.append('payment_amount',   paymentAmount.toFixed(2))
    formData.append('security_deposit', values.security_deposit || '0')
    formData.append('terms',            values.terms || '')
    formData.append('schedule', JSON.stringify(
      scheduleRows.map((r) => ({ due_date: r.due_date, amount: parseFloat(r.amount.toFixed(2)) }))
    ))
    return formData
  }

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await createContract({ success: false, error: null, fieldErrors: {} }, buildFormData(values, 'active'))
      if (result.success) {
        toast.success('تم إنشاء العقد والفواتير بنجاح')
        onOpenChange(false)
        onSuccess?.()
      } else {
        setServerError(result.error)
        if (result.error) toast.error(result.error)
      }
    })
  }

  function onSaveDraft(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await createContract({ success: false, error: null, fieldErrors: {} }, buildFormData(values, 'draft'))
      if (result.success) {
        toast.success('تم حفظ العقد كمسودة')
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
    sub:   (u as any).property?.name ?? '',
  }))

  const tenantOptions = tenants.map((t) => ({
    value: t.id,
    label: t.company_name?.trim() ? t.company_name : t.full_name,
    sub:   t.company_name?.trim() ? t.full_name : (t.phone ?? t.email ?? ''),
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>إنشاء عقد إيجار جديد</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* الوحدة + المستأجر */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>الوحدة *</Label>
              <Combobox
                options={unitOptions}
                value={unitIdValue}
                onValueChange={(v) => setValue('unit_id', v, { shouldValidate: true })}
                placeholder="اختر الوحدة..."
                searchPlaceholder="بحث..."
                emptyMessage="لا توجد وحدات متاحة"
              />
              {errors.unit_id && <p className="text-xs text-destructive">{errors.unit_id.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>المستأجر *</Label>
              <Combobox
                options={tenantOptions}
                value={watch('tenant_id')}
                onValueChange={(v) => setValue('tenant_id', v, { shouldValidate: true })}
                placeholder="اختر المستأجر..."
                searchPlaceholder="بحث..."
                emptyMessage="لا يوجد مستأجرون"
              />
              {errors.tenant_id && <p className="text-xs text-destructive">{errors.tenant_id.message}</p>}
            </div>
          </div>

          {/* نوع العقد */}
          <div className="space-y-1.5">
            <Label>نوع العقد *</Label>
            <Select
              value={watch('contract_type')}
              onValueChange={(v) => setValue('contract_type', v as 'full_time' | 'part_time', { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر نوع العقد" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">🔵 دوام كامل</SelectItem>
                <SelectItem value="part_time">🟡 دوام جزئي</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* تواريخ */}
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

          {/* ─── قسم الدفع ─────────────────────────────────────────────── */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
            <p className="text-sm font-semibold">نظام الدفع</p>

            {/* الإجمالي السنوي + التأمين */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="total_amount">إجمالي الإيجار (د.إ) *</Label>
                <Input
                  id="total_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('total_amount')}
                  placeholder="60000"
                />
                {errors.total_amount && <p className="text-xs text-destructive">{errors.total_amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="security_deposit">مبلغ التأمين (د.إ)</Label>
                <Input id="security_deposit" type="number" min="0" {...register('security_deposit')} placeholder="0" />
              </div>
            </div>

            {/* طريقة الدفع */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>طريقة الدفع *</Label>
                <Select
                  value={paymentCountKey}
                  onValueChange={(v) => setValue('payment_count_key', v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر طريقة الدفع" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_COUNT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.payment_count_key && <p className="text-xs text-destructive">{errors.payment_count_key.message}</p>}
              </div>

              {/* عدد مخصص */}
              {paymentCountKey === 'custom' && (
                <div className="space-y-1.5">
                  <Label htmlFor="custom_count">عدد الدفعات</Label>
                  <Input
                    id="custom_count"
                    type="number"
                    min="1"
                    max="365"
                    {...register('custom_count')}
                    placeholder="مثال: 6"
                  />
                  {errors.custom_count && <p className="text-xs text-destructive">{errors.custom_count.message}</p>}
                </div>
              )}

              {/* مبلغ كل دفعة — computed */}
              {paymentCount > 0 && totalAmount > 0 && paymentCountKey !== 'custom' && (
                <div className="space-y-1.5">
                  <Label>مبلغ كل دفعة</Label>
                  <div className="flex h-9 items-center rounded-md border bg-background px-3 text-sm font-semibold text-green-600">
                    {paymentAmount.toLocaleString('ar-AE', { minimumFractionDigits: 2 })} د.إ
                  </div>
                </div>
              )}
            </div>

            {/* ─── جدول الدفعات القابل للتعديل ─────────────────────── */}
            {scheduleRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    جدول الدفعات
                    <span className="text-xs text-muted-foreground font-normal">
                      (يمكنك تعديل التاريخ والمبلغ لكل دفعة)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setScheduleRows(defaultSchedule)}
                  >
                    <RefreshCw className="h-3 w-3" />
                    إعادة ضبط
                  </Button>
                </div>

                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground w-8">#</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">تاريخ الاستحقاق</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">المبلغ (د.إ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleRows.map((row) => (
                        <tr key={row.index} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-1.5 text-muted-foreground text-center">{row.index}</td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="date"
                              value={row.due_date}
                              onChange={(e) => updateRow(row.index, 'due_date', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.amount}
                              onChange={(e) => updateRow(row.index, 'amount', e.target.value)}
                              className="h-8 text-sm font-semibold text-green-700"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className={`border-t ${amountMismatch ? 'bg-red-50' : 'bg-muted/30'}`}>
                        <td colSpan={2} className="px-3 py-2 text-sm font-semibold text-muted-foreground">
                          الإجمالي
                          {amountMismatch && (
                            <span className="text-red-500 text-xs me-2">
                              (يختلف عن إجمالي العقد: {totalAmount.toLocaleString('ar-AE')} د.إ)
                            </span>
                          )}
                        </td>
                        <td className={`px-3 py-2 font-bold ${amountMismatch ? 'text-red-600' : ''}`}>
                          {scheduleTotalAmount.toLocaleString('ar-AE', { minimumFractionDigits: 2 })} د.إ
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* الشروط */}
          <div className="space-y-1.5">
            <Label htmlFor="terms">شروط العقد</Label>
            <Textarea id="terms" {...register('terms')} placeholder="أي شروط أو ملاحظات خاصة..." rows={2} />
          </div>

          {serverError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{serverError}</p>
          )}

          <DialogFooter className="gap-2 pt-2 flex-wrap">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              إلغاء
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={handleSubmit(onSaveDraft)}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ كمسودة
            </Button>
            <Button type="submit" disabled={isPending || paymentCount < 1}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              إنشاء العقد {scheduleRows.length > 0 && `(${scheduleRows.length} فواتير)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
