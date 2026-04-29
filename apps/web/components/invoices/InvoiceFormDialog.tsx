'use client'

import { useEffect, useActionState, useTransition } from 'react'
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
import { createInvoice, updateInvoice, type InvoiceFormState } from '@/app/(dashboard)/dashboard/invoices/actions'
import type { Tenant, Contract, Unit, Property } from '@repo/types'
import type { InvoiceRow } from './InvoicesClient'

type ContractWithUnit = Contract & {
  unit: (Unit & { property: Pick<Property, 'id' | 'name'> }) | null
}

interface InvoiceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  tenants: (Pick<Tenant, 'id' | 'full_name'> & { company_name?: string | null })[]
  contracts: ContractWithUnit[]
  invoice?: InvoiceRow | null   // when set → edit mode
}

const INVOICE_TYPES = [
  { value: 'rent',        label: 'إيجار' },
  { value: 'maintenance', label: 'صيانة' },
  { value: 'utility',     label: 'خدمات' },
  { value: 'deposit',     label: 'تأمين' },
  { value: 'other',       label: 'أخرى' },
]

const INVOICE_STATUSES = [
  { value: 'pending',   label: 'معلقة' },
  { value: 'paid',      label: 'مدفوعة' },
  { value: 'overdue',   label: 'متأخرة' },
  { value: 'partial',   label: 'مدفوعة جزئياً' },
  { value: 'draft',     label: 'مسودة' },
  { value: 'cancelled', label: 'ملغاة' },
]

const initialState: InvoiceFormState = { success: false, error: null, fieldErrors: {} }

export function InvoiceFormDialog({
  open,
  onOpenChange,
  onSuccess,
  tenants,
  contracts,
  invoice,
}: InvoiceFormDialogProps) {
  const isEdit = !!invoice

  const [isPending, startTransition] = useTransition()

  // bind the action to invoice id when editing
  const boundAction = isEdit
    ? updateInvoice.bind(null, invoice!.id)
    : createInvoice

  const [state, formAction, pending] = useActionState(boundAction, initialState)

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? 'تم تعديل الفاتورة بنجاح' : 'تم إنشاء الفاتورة بنجاح')
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
          <DialogTitle>{isEdit ? 'تعديل الفاتورة' : 'إنشاء فاتورة جديدة'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* Tenant — shown only in create mode */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="if-tenant">المستأجر *</Label>
              <Select name="tenant_id" required>
                <SelectTrigger id="if-tenant">
                  <SelectValue placeholder="اختر مستأجراً" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.company_name || t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.fieldErrors.tenant_id && (
                <p className="text-xs text-destructive">{state.fieldErrors.tenant_id[0]}</p>
              )}
            </div>
          )}

          {/* Tenant name (read-only) in edit mode */}
          {isEdit && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              المستأجر:{' '}
              <span className="font-medium text-foreground">
                {invoice!.tenant?.company_name || invoice!.tenant?.full_name || '—'}
              </span>
            </div>
          )}

          {/* Contract (optional) — create mode only */}
          {!isEdit && contracts.length > 0 && (
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
              <Select name="type" defaultValue={invoice?.type ?? 'rent'}>
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
                defaultValue={invoice?.amount ?? ''}
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
                defaultValue={invoice?.tax_amount ?? 0}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="if-due">تاريخ الاستحقاق *</Label>
              <Input
                id="if-due"
                name="due_date"
                type="date"
                defaultValue={invoice?.due_date?.slice(0, 10) ?? ''}
                required
              />
              {state.fieldErrors.due_date && (
                <p className="text-xs text-destructive">{state.fieldErrors.due_date[0]}</p>
              )}
            </div>
          </div>

          {/* Status — edit mode only */}
          {isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="if-status">الحالة</Label>
              <Select name="status" defaultValue={invoice!.status}>
                <SelectTrigger id="if-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="if-notes">ملاحظات</Label>
            <Textarea
              id="if-notes"
              name="notes"
              rows={2}
              placeholder="ملاحظات إضافية..."
              defaultValue={invoice?.notes ?? ''}
            />
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
            <Button type="submit" disabled={isPending || pending}>
              {isPending || pending
                ? (isEdit ? 'جاري الحفظ...' : 'جاري الإنشاء...')
                : (isEdit ? 'حفظ التعديلات' : 'إنشاء الفاتورة')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
