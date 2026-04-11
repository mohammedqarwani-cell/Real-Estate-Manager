'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { recordPayment } from '@/app/(dashboard)/dashboard/invoices/actions'
import type { InvoiceStatus } from '@repo/types'

export interface InvoiceForPayment {
  id: string
  invoice_number: string
  total_amount: number
  status: InvoiceStatus
  tenant_name: string
}

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  invoice: InvoiceForPayment | null
}

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'نقداً' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'cheque',        label: 'شيك' },
  { value: 'card',          label: 'بطاقة' },
  { value: 'online',        label: 'دفع إلكتروني' },
]

const initialState = { success: false, error: null as string | null, fieldErrors: {} as Record<string, string[]> }

export function PaymentDialog({ open, onOpenChange, onSuccess, invoice }: PaymentDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  if (!invoice) return null

  const today = new Date().toISOString().split('T')[0]

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await recordPayment(invoice.id, initialState, fd)
      if (result.success) {
        toast.success('تم تسجيل الدفعة بنجاح')
        onSuccess()
        onOpenChange(false)
      } else {
        setError(result.error)
        setFieldErrors(result.fieldErrors ?? {})
        if (result.error) toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسجيل دفعة</DialogTitle>
        </DialogHeader>

        {/* Invoice summary */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">رقم الفاتورة</span>
            <span className="font-mono font-medium">{invoice.invoice_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">المستأجر</span>
            <span className="font-medium">{invoice.tenant_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">المبلغ الإجمالي</span>
            <span className="font-bold text-base">{invoice.total_amount.toLocaleString('ar-AE')} د.إ</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount paid */}
          <div className="space-y-1.5">
            <Label htmlFor="pd-amount">المبلغ المدفوع (د.إ) *</Label>
            <Input
              id="pd-amount"
              name="amount_paid"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={invoice.total_amount}
              required
            />
            {fieldErrors.amount_paid && (
              <p className="text-xs text-destructive">{fieldErrors.amount_paid[0]}</p>
            )}
          </div>

          {/* Payment method */}
          <div className="space-y-1.5">
            <Label htmlFor="pd-method">طريقة الدفع *</Label>
            <Select
              name="payment_method"
              value={paymentMethod}
              onValueChange={setPaymentMethod}
            >
              <SelectTrigger id="pd-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reference number — shown for transfer or cheque */}
          {(paymentMethod === 'bank_transfer' || paymentMethod === 'cheque') && (
            <div className="space-y-1.5">
              <Label htmlFor="pd-ref">
                {paymentMethod === 'bank_transfer' ? 'رقم التحويل المرجعي' : 'رقم الشيك'}
              </Label>
              <Input
                id="pd-ref"
                name="reference_number"
                placeholder={paymentMethod === 'bank_transfer' ? 'TXN-...' : 'CHQ-...'}
              />
            </div>
          )}

          {/* Paid date */}
          <div className="space-y-1.5">
            <Label htmlFor="pd-date">تاريخ الدفع *</Label>
            <Input
              id="pd-date"
              name="paid_date"
              type="date"
              defaultValue={today}
              required
            />
            {fieldErrors.paid_date && (
              <p className="text-xs text-destructive">{fieldErrors.paid_date[0]}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="pd-notes">ملاحظات</Label>
            <Textarea id="pd-notes" name="notes" rows={2} placeholder="ملاحظات..." />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
          )}

          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'جاري التسجيل...' : 'تسجيل الدفعة'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
