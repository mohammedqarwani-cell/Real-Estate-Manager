'use client'

import { format, parseISO } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  FileText, User, Home, DollarSign, Calendar,
  CheckCircle2, Clock, AlertTriangle, CreditCard, Ban, Hash,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import type { InvoiceRow } from './InvoicesClient'
import type { InvoiceStatus } from '@repo/types'

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string; icon: React.ElementType }> = {
  draft:    { label: 'مسودة',          className: 'bg-gray-100   text-gray-600',   icon: Clock         },
  pending:  { label: 'معلقة',           className: 'bg-yellow-100 text-yellow-700', icon: Clock         },
  paid:     { label: 'مدفوعة',         className: 'bg-green-100  text-green-700',  icon: CheckCircle2  },
  overdue:  { label: 'متأخرة',         className: 'bg-red-100    text-red-700',    icon: AlertTriangle },
  partial:  { label: 'مدفوعة جزئياً', className: 'bg-orange-100 text-orange-700', icon: CreditCard    },
  cancelled:{ label: 'ملغاة',          className: 'bg-gray-100   text-gray-500',   icon: Ban           },
}

const INVOICE_TYPE_LABELS: Record<string, string> = {
  rent:        'إيجار',
  maintenance: 'صيانة',
  utility:     'خدمات',
  deposit:     'تأمين',
  other:       'أخرى',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash:          'نقدي',
  bank_transfer: 'تحويل بنكي',
  cheque:        'شيك',
  card:          'بطاقة',
  online:        'دفع إلكتروني',
}

// ─── Row helper ─────────────────────────────────────────────────────────────

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b last:border-0 gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm font-medium text-left break-words ${highlight ? 'text-green-600 font-bold' : ''}`}>
        {value}
      </span>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

interface InvoiceDetailDialogProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
  invoice:      InvoiceRow | null
}

export function InvoiceDetailDialog({ open, onOpenChange, invoice }: InvoiceDetailDialogProps) {
  if (!invoice) return null

  const status  = STATUS_CONFIG[invoice.status]
  const Icon    = status.icon
  const tenant  = invoice.tenant
  const unit    = invoice.unit as any

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            تفاصيل الفاتورة
          </DialogTitle>
          <DialogDescription className="sr-only">تفاصيل الفاتورة الكاملة</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">

          {/* رقم الفاتورة + الحالة */}
          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono font-semibold tracking-wide">{invoice.invoice_number}</span>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
              <Icon className="h-3 w-3" />
              {status.label}
            </span>
          </div>

          {/* بيانات المستأجر */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              <User className="h-3.5 w-3.5" />
              المستأجر
            </div>
            <div className="rounded-xl border px-4 divide-y">
              <Row label="الاسم"   value={tenant?.company_name || tenant?.full_name || '—'} />
              {tenant?.company_name && <Row label="المسؤول" value={tenant.full_name} />}
              {tenant?.email && <Row label="البريد" value={tenant.email} />}
            </div>
          </div>

          {/* العقار والوحدة */}
          {unit && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                <Home className="h-3.5 w-3.5" />
                الوحدة
              </div>
              <div className="rounded-xl border px-4 divide-y">
                <Row label="العقار"  value={unit.property?.name ?? '—'} />
                <Row label="الوحدة"  value={`وحدة ${unit.unit_number}`} />
              </div>
            </div>
          )}

          {/* التفاصيل المالية */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              <DollarSign className="h-3.5 w-3.5" />
              التفاصيل المالية
            </div>
            <div className="rounded-xl border px-4 divide-y">
              <Row label="النوع"    value={INVOICE_TYPE_LABELS[invoice.type] ?? invoice.type} />
              <Row label="المبلغ"   value={`${invoice.amount.toLocaleString('ar-AE')} د.إ`} />
              {invoice.tax_amount > 0 && (
                <Row label="الضريبة" value={`${invoice.tax_amount.toLocaleString('ar-AE')} د.إ`} />
              )}
              <Row
                label="الإجمالي"
                value={`${invoice.total_amount.toLocaleString('ar-AE')} د.إ`}
                highlight
              />
            </div>
          </div>

          {/* التواريخ والدفع */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              <Calendar className="h-3.5 w-3.5" />
              التواريخ والدفع
            </div>
            <div className="rounded-xl border px-4 divide-y">
              <Row
                label="تاريخ الاستحقاق"
                value={format(parseISO(invoice.due_date), 'dd MMMM yyyy', { locale: ar })}
              />
              {invoice.paid_date && (
                <Row
                  label="تاريخ الدفع"
                  value={format(parseISO(invoice.paid_date), 'dd MMMM yyyy', { locale: ar })}
                />
              )}
              {invoice.payment_method && (
                <Row
                  label="طريقة الدفع"
                  value={PAYMENT_METHOD_LABELS[invoice.payment_method] ?? invoice.payment_method}
                />
              )}
            </div>
          </div>

          {/* الملاحظات */}
          {invoice.notes && (
            <div className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {invoice.notes}
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}
