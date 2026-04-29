'use client'

import { useEffect, useState, useTransition, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, CalendarDays, RefreshCw } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { renewContract } from '@/app/(dashboard)/dashboard/contracts/actions'

// ─── Schema ────────────────────────────────────────────────────────────────

const PAYMENT_COUNT_OPTIONS = [
  { value: '1',      label: 'دفعة واحدة (كامل المبلغ)' },
  { value: '2',      label: 'دفعتان (كل 6 أشهر)' },
  { value: '3',      label: '3 دفعات (كل 4 أشهر)' },
  { value: '4',      label: '4 دفعات (كل 3 أشهر)' },
  { value: '12',     label: '12 دفعة (شهري)' },
  { value: 'custom', label: 'مخصص...' },
]

const formSchema = z.object({
  contract_type:     z.enum(['full_time', 'part_time']),
  start_date:        z.string().min(1, 'تاريخ البداية مطلوب'),
  end_date:          z.string().min(1, 'تاريخ النهاية مطلوب'),
  total_amount:      z.string().min(1, 'إجمالي الإيجار مطلوب'),
  security_deposit:  z.string().optional(),
  payment_count_key: z.string().min(1, 'يرجى اختيار طريقة الدفع'),
  custom_count:      z.string().optional(),
  terms:             z.string().optional(),
}).refine(
  (d) => !d.start_date || !d.end_date || new Date(d.end_date) > new Date(d.start_date),
  { message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية', path: ['end_date'] }
).refine(
  (d) => {
    if (d.payment_count_key !== 'custom') return true
    const n = parseInt(d.custom_count ?? '0')
    return n >= 1 && n <= 365
  },
  { message: 'عدد الدفعات يجب أن يكون بين 1 و 365', path: ['custom_count'] }
)

type FormValues = z.infer<typeof formSchema>

interface ScheduleRow { index: number; due_date: string; amount: number }

export interface OldContractData {
  id:               string
  end_date:         string
  total_amount:     number
  payment_count:    number
  payment_amount:   number
  security_deposit: number
  contract_type:    string
  terms:            string | null
}

interface RenewContractDialogProps {
  open:          boolean
  onOpenChange:  (open: boolean) => void
  oldContract:   OldContractData
}

// ─── helpers ───────────────────────────────────────────────────────────────

function addOneDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function addOneYear(dateStr: string): string {
  const d = new Date(dateStr)
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().split('T')[0]
}

function computeSchedule(
  startDate: string, endDate: string, count: number, amount: number
): ScheduleRow[] {
  if (!startDate || !endDate || count < 1 || amount <= 0) return []
  const start   = new Date(startDate)
  const end     = new Date(endDate)
  if (end <= start) return []
  const intervalMs = (end.getTime() - start.getTime()) / count
  return Array.from({ length: count }, (_, i) => ({
    index:    i + 1,
    due_date: new Date(start.getTime() + intervalMs * i).toISOString().split('T')[0],
    amount,
  }))
}

function paymentCountKey(count: number): string {
  if ([1, 2, 3, 4, 12].includes(count)) return String(count)
  return 'custom'
}

// ─── Component ─────────────────────────────────────────────────────────────

export function RenewContractDialog({ open, onOpenChange, oldContract }: RenewContractDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([])

  const defaultStart = addOneDay(oldContract.end_date)
  const defaultEnd   = addOneYear(oldContract.end_date)
  const oldKey       = paymentCountKey(oldContract.payment_count)

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contract_type:     (oldContract.contract_type as 'full_time' | 'part_time') ?? 'full_time',
      start_date:        defaultStart,
      end_date:          defaultEnd,
      total_amount:      String(oldContract.total_amount || ''),
      security_deposit:  String(oldContract.security_deposit ?? 0),
      payment_count_key: oldKey,
      custom_count:      oldKey === 'custom' ? String(oldContract.payment_count) : '',
      terms:             oldContract.terms ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        contract_type:     (oldContract.contract_type as 'full_time' | 'part_time') ?? 'full_time',
        start_date:        defaultStart,
        end_date:          defaultEnd,
        total_amount:      String(oldContract.total_amount || ''),
        security_deposit:  String(oldContract.security_deposit ?? 0),
        payment_count_key: oldKey,
        custom_count:      oldKey === 'custom' ? String(oldContract.payment_count) : '',
        terms:             oldContract.terms ?? '',
      })
      setServerError(null)
      setScheduleRows([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const totalAmountStr  = watch('total_amount')
  const startDateStr    = watch('start_date')
  const endDateStr      = watch('end_date')
  const paymentCountKey_ = watch('payment_count_key')
  const customCountStr  = watch('custom_count')

  const paymentCount = useMemo(() => {
    if (paymentCountKey_ === 'custom') {
      const n = parseInt(customCountStr ?? '0')
      return isNaN(n) || n < 1 ? 0 : n
    }
    return parseInt(paymentCountKey_) || 0
  }, [paymentCountKey_, customCountStr])

  const totalAmount   = parseFloat(totalAmountStr) || 0
  const paymentAmount = paymentCount > 0 ? totalAmount / paymentCount : 0

  const defaultSchedule = useMemo(
    () => computeSchedule(startDateStr, endDateStr, paymentCount, paymentAmount),
    [startDateStr, endDateStr, paymentCount, paymentAmount]
  )

  useEffect(() => { setScheduleRows(defaultSchedule) }, [defaultSchedule])

  function updateRow(index: number, field: 'due_date' | 'amount', value: string) {
    setScheduleRows((prev) =>
      prev.map((row) =>
        row.index === index
          ? { ...row, [field]: field === 'amount' ? parseFloat(value) || 0 : value }
          : row
      )
    )
  }

  const scheduleTotalAmount = scheduleRows.reduce((s, r) => s + r.amount, 0)
  const amountMismatch = scheduleRows.length > 0 && Math.abs(scheduleTotalAmount - totalAmount) > 0.5

  function onSubmit(values: FormValues) {
    setServerError(null)
    const formData = new FormData()
    formData.append('contract_type',    values.contract_type)
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

    startTransition(async () => {
      const result = await renewContract(
        oldContract.id,
        { success: false, error: null, fieldErrors: {} },
        formData
      )
      if (result.success) {
        toast.success('تم تجديد العقد وإنشاء الفواتير بنجاح')
        onOpenChange(false)
        if (result.newContractId) {
          router.push(`/dashboard/contracts/${result.newContractId}`)
        } else {
          router.refresh()
        }
      } else {
        setServerError(result.error)
        if (result.error) toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تجديد العقد</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* إشعار */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
            سيتم تحديث العقد الحالي إلى <strong>مجدد</strong> وإنشاء عقد جديد ساري تلقائياً.
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

          {/* نظام الدفع */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
            <p className="text-sm font-semibold">نظام الدفع</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="total_amount">إجمالي الإيجار (د.إ) *</Label>
                <Input id="total_amount" type="number" min="0" step="0.01" {...register('total_amount')} placeholder="60000" />
                {errors.total_amount && <p className="text-xs text-destructive">{errors.total_amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="security_deposit">مبلغ التأمين (د.إ)</Label>
                <Input id="security_deposit" type="number" min="0" {...register('security_deposit')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>طريقة الدفع *</Label>
                <Select
                  value={paymentCountKey_}
                  onValueChange={(v) => setValue('payment_count_key', v, { shouldValidate: true })}
                >
                  <SelectTrigger><SelectValue placeholder="اختر طريقة الدفع" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_COUNT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.payment_count_key && <p className="text-xs text-destructive">{errors.payment_count_key.message}</p>}
              </div>

              {paymentCountKey_ === 'custom' && (
                <div className="space-y-1.5">
                  <Label htmlFor="custom_count">عدد الدفعات</Label>
                  <Input id="custom_count" type="number" min="1" max="365" {...register('custom_count')} placeholder="مثال: 6" />
                  {errors.custom_count && <p className="text-xs text-destructive">{errors.custom_count.message}</p>}
                </div>
              )}

              {paymentCount > 0 && totalAmount > 0 && paymentCountKey_ !== 'custom' && (
                <div className="space-y-1.5">
                  <Label>مبلغ كل دفعة</Label>
                  <div className="flex h-9 items-center rounded-md border bg-background px-3 text-sm font-semibold text-green-600">
                    {paymentAmount.toLocaleString('ar-AE', { minimumFractionDigits: 2 })} د.إ
                  </div>
                </div>
              )}
            </div>

            {/* جدول الدفعات */}
            {scheduleRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    جدول الدفعات
                    <span className="text-xs text-muted-foreground font-normal">(يمكنك تعديل التاريخ والمبلغ)</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground"
                    onClick={() => setScheduleRows(defaultSchedule)}>
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
                            <Input type="date" value={row.due_date}
                              onChange={(e) => updateRow(row.index, 'due_date', e.target.value)}
                              className="h-8 text-sm" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" min="0" step="0.01" value={row.amount}
                              onChange={(e) => updateRow(row.index, 'amount', e.target.value)}
                              className="h-8 text-sm font-semibold text-green-700" />
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
            <Textarea id="terms" {...register('terms')} placeholder="أي شروط أو ملاحظات..." rows={2} />
          </div>

          {serverError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{serverError}</p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending || paymentCount < 1} className="bg-green-600 hover:bg-green-700">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              تجديد العقد {scheduleRows.length > 0 && `(${scheduleRows.length} فواتير)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
