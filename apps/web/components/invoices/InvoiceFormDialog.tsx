'use client'

import { useEffect, useActionState } from 'react'
import { useTransition } from 'react'
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
import { createInvoice, type InvoiceFormState } from '@/app/(dashboard)/dashboard/invoices/actions'
import type { Tenant, Contract, Unit, Property } from '@repo/types'

type ContractWithUnit = Contract & {
  unit: (Unit & { property: Pick<Property, 'id' | 'name'> }) | null
}

interface InvoiceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  tenants: Pick<Tenant, 'id' | 'full_name'>[]
  contracts: ContractWithUnit[]
}

const INVOICE_TYPES = [
  { value: 'rent',        label: 'إيجار' },
  { value: 'maintenance', label: 'صيانة' },
  { value: 'utility',     label: 'خدمات' },
  { value: 'deposit',     label: 'تأمين' },
  { value: 'other',       label: 'أخرى' },
]

const initialState: InvoiceFormState = { success: false, error: null, fieldErrors: {} }

export function InvoiceFormDialog({
  open,
  onOpenChange,
  onSuccess,
  tenants,
  contracts,
}: InvoiceFormDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [state, formAction] = useActionState(createInvoice, initialState)

  // Watch for success
  useEffect(() => {
    if (state.success) {
      toast.success('تم إنشاء الفاتورة بنجاح')
      onSuccess()
      onOpenChange(false)
    }
    if (state.error && !state.success) {
      toast.error(state.error)
    }
  }, [state])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => formAction(fd))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>إنشاء فاتورة جديدة</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Tenant */}
          <div className="space-y-1.5">
            <Label htmlFor="if-tenant">المستأجر *</Label>
            <Select name="tenant_id" required>
              <SelectTrigger id="if-tenant">
                <SelectValue placeholder="اختر مستأجراً" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.fieldErrors.tenant_id && (
              <p className="text-xs text-destructive">{state.fieldErrors.tenant_id[0]}</p>
            )}
          </div>

          {/* Contract (optional) */}
          {contracts.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="if-contract">العقد (اختياري)</Label>
              <Select name="contract_id">
                <SelectTrigger id="if-contract">
                  <SelectValue placeholder="اختر عقداً" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون عقد</SelectItem>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.unit?.property?.name ?? ''} — وحدة {c.unit?.unit_number ?? ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Type + Amount row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="if-type">نوع الفاتورة *</Label>
              <Select name="type" defaultValue="rent">
                <SelectTrigger id="if-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="if-amount">المبلغ (د.إ) *</Label>
              <Input
                id="if-amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
              {state.fieldErrors.amount && (
                <p className="text-xs text-destructive">{state.fieldErrors.amount[0]}</p>
              )}
            </div>
          </div>

          {/* Tax + Due date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="if-tax">ضريبة القيمة المضافة (د.إ)</Label>
              <Input
                id="if-tax"
                name="tax_amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="if-due">تاريخ الاستحقاق *</Label>
              <Input
                id="if-due"
                name="due_date"
                type="date"
                required
              />
              {state.fieldErrors.due_date && (
                <p className="text-xs text-destructive">{state.fieldErrors.due_date[0]}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="if-notes">ملاحظات</Label>
            <Textarea id="if-notes" name="notes" rows={2} placeholder="ملاحظات إضافية..." />
          </div>

          {state.error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {state.error}
            </p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'جاري الإنشاء...' : 'إنشاء الفاتورة'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
