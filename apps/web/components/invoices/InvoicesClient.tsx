'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, isPast, parseISO } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  Plus,
  Search,
  DollarSign,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Ban,
  CreditCard,
  Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InvoiceFormDialog } from './InvoiceFormDialog'
import { PaymentDialog, type InvoiceForPayment } from './PaymentDialog'
import { generateMonthlyInvoices, cancelInvoice } from '@/app/(dashboard)/dashboard/invoices/actions'
import type { InvoiceStatus, Tenant, Contract, Unit, Property } from '@repo/types'

// ─── Types ─────────────────────────────────────────────────────────────────

type UnitWithProperty = Unit & { property: Pick<Property, 'id' | 'name'> }
type ContractWithUnit = Contract & { unit: UnitWithProperty | null }

export type InvoiceRow = {
  id: string
  invoice_number: string
  type: string
  amount: number
  tax_amount: number
  total_amount: number
  due_date: string
  paid_date: string | null
  status: InvoiceStatus
  payment_method: string | null
  notes: string | null
  tenant: Pick<Tenant, 'id' | 'full_name' | 'email'> | null
  unit: (Pick<Unit, 'id' | 'unit_number'> & { property?: Pick<Property, 'id' | 'name'> }) | null
}

interface InvoicesClientProps {
  invoices: InvoiceRow[]
  tenants: Pick<Tenant, 'id' | 'full_name'>[]
  contracts: ContractWithUnit[]
  properties: Pick<Property, 'id' | 'name'>[]
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string; icon: React.ElementType; dotClass: string }> = {
  draft:    { label: 'مسودة',          className: 'bg-gray-100   text-gray-600',    icon: Clock,        dotClass: 'bg-gray-400'   },
  pending:  { label: 'معلقة',           className: 'bg-yellow-100 text-yellow-700',  icon: Clock,        dotClass: 'bg-yellow-500' },
  paid:     { label: 'مدفوعة',         className: 'bg-green-100  text-green-700',   icon: CheckCircle2, dotClass: 'bg-green-500'  },
  overdue:  { label: 'متأخرة',         className: 'bg-red-100    text-red-700',     icon: AlertTriangle,dotClass: 'bg-red-500'    },
  partial:  { label: 'مدفوعة جزئياً', className: 'bg-orange-100 text-orange-700',  icon: CreditCard,   dotClass: 'bg-orange-500' },
  cancelled:{ label: 'ملغاة',          className: 'bg-gray-100   text-gray-500',    icon: Ban,          dotClass: 'bg-gray-300'   },
}

const INVOICE_TYPE_LABELS: Record<string, string> = {
  rent:        'إيجار',
  maintenance: 'صيانة',
  utility:     'خدمات',
  deposit:     'تأمين',
  other:       'أخرى',
}

// ─── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function InvoicesClient({ invoices, tenants, contracts, properties }: InvoicesClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [createOpen, setCreateOpen]     = useState(false)
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceForPayment | null>(null)
  const [paymentOpen, setPaymentOpen]   = useState(false)

  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [propertyFilter, setPropertyFilter] = useState<string>('all')

  // ── Filtering ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let data = invoices
    if (statusFilter !== 'all') data = data.filter((i) => i.status === statusFilter)
    if (propertyFilter !== 'all')
      data = data.filter((i) => (i.unit as any)?.property?.id === propertyFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      data = data.filter((i) =>
        i.invoice_number.toLowerCase().includes(q) ||
        i.tenant?.full_name?.toLowerCase().includes(q) ||
        i.unit?.unit_number?.toLowerCase().includes(q)
      )
    }
    return data
  }, [invoices, statusFilter, propertyFilter, search])

  const counts = useMemo(() => ({
    all:       invoices.length,
    pending:   invoices.filter((i) => i.status === 'pending').length,
    overdue:   invoices.filter((i) => i.status === 'overdue').length,
    paid:      invoices.filter((i) => i.status === 'paid').length,
    partial:   invoices.filter((i) => i.status === 'partial').length,
    cancelled: invoices.filter((i) => i.status === 'cancelled').length,
  }), [invoices])

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleGenerateMonthly = () => {
    const now = new Date()
    startTransition(async () => {
      const result = await generateMonthlyInvoices(now.getFullYear(), now.getMonth() + 1)
      if (result.success) {
        toast.success(`تم توليد ${result.created} فاتورة — تخطي ${result.skipped} موجودة`)
        router.refresh()
      } else {
        toast.error('خطأ في توليد الفواتير: ' + result.error)
      }
    })
  }

  const handleOpenPayment = (inv: InvoiceRow) => {
    setPaymentInvoice({
      id: inv.id,
      invoice_number: inv.invoice_number,
      total_amount: inv.total_amount,
      status: inv.status,
      tenant_name: inv.tenant?.full_name ?? '—',
    })
    setPaymentOpen(true)
  }

  const handlePrintInvoice = async (inv: InvoiceRow) => {
    try {
      const { generateInvoicePDF } = await import('@/components/pdf/generate')
      const blob = await generateInvoicePDF(inv)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${inv.invoice_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Invoice PDF error:', err)
      toast.error('حدث خطأ أثناء توليد PDF')
    }
  }

  const handleCancelInvoice = (id: string) => {
    if (!confirm('هل أنت متأكد من إلغاء هذه الفاتورة؟')) return
    startTransition(async () => {
      const result = await cancelInvoice(id)
      if (result.success) {
        toast.success('تم إلغاء الفاتورة')
        router.refresh()
      } else {
        toast.error(result.error ?? 'حدث خطأ')
      }
    })
  }

  // ── Status filter tabs ───────────────────────────────────────────────────

  const statusTabs: { key: string; label: string }[] = [
    { key: 'all',       label: 'الكل' },
    { key: 'pending',   label: 'معلقة' },
    { key: 'overdue',   label: 'متأخرة' },
    { key: 'paid',      label: 'مدفوعة' },
    { key: 'partial',   label: 'جزئية' },
    { key: 'cancelled', label: 'ملغاة' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">الفواتير</h1>
            {counts.overdue > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                <AlertTriangle className="h-3 w-3" />
                {counts.overdue} متأخرة
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {invoices.length} فاتورة إجمالاً
          </p>
        </div>
        <div className="flex gap-2 shrink-0 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={handleGenerateMonthly}
            disabled={isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
            توليد فواتير الشهر
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            فاتورة جديدة
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center" dir="rtl">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم الفاتورة أو المستأجر..."
            className="pr-9"
          />
        </div>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {statusTabs.map(({ key, label }) => {
            const count = counts[key as keyof typeof counts] ?? invoices.filter((i) => i.status === key).length
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  statusFilter === key
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {key !== 'all' && (
                  <span className={`h-2 w-2 rounded-full ${STATUS_CONFIG[key as InvoiceStatus]?.dotClass ?? 'bg-gray-300'}`} />
                )}
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === key ? 'bg-background/20' : 'bg-muted'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Property filter */}
        {properties.length > 0 && (
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="كل العقارات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العقارات</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {invoices.length === 0 ? 'لا توجد فواتير بعد' : 'لا توجد نتائج مطابقة'}
            </p>
            {invoices.length === 0 && (
              <Button onClick={() => setCreateOpen(true)} className="mt-4" variant="outline">
                <Plus className="h-4 w-4" />
                إنشاء أول فاتورة
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">رقم الفاتورة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">المستأجر</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">العقار / الوحدة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">النوع</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">المبلغ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">الاستحقاق</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">الحالة</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const isOverdueDate = inv.status === 'pending' && isPast(parseISO(inv.due_date))
                  const canPay = ['pending', 'overdue', 'partial'].includes(inv.status)
                  const canCancel = ['pending', 'overdue', 'draft'].includes(inv.status)
                  return (
                    <tr key={inv.id} className="group border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {inv.invoice_number}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {inv.tenant?.full_name ?? '—'}
                        {inv.tenant?.email && (
                          <div className="text-xs text-muted-foreground">{inv.tenant.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {inv.unit ? (
                          <>
                            <div className="font-medium">{(inv.unit as any).property?.name ?? '—'}</div>
                            <div className="text-xs text-muted-foreground">وحدة {inv.unit.unit_number}</div>
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {INVOICE_TYPE_LABELS[inv.type] ?? inv.type}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">
                          {inv.total_amount.toLocaleString('ar-AE')}
                        </span>
                        <span className="text-xs text-muted-foreground mr-1">د.إ</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className={isOverdueDate ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                          {format(parseISO(inv.due_date), 'dd MMM yyyy', { locale: ar })}
                        </div>
                        {inv.paid_date && (
                          <div className="text-xs text-green-600">
                            دُفع {format(parseISO(inv.paid_date), 'dd MMM yyyy', { locale: ar })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <button
                            onClick={() => handlePrintInvoice(inv)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                            title="طباعة الفاتورة PDF"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          {canPay && (
                            <button
                              onClick={() => handleOpenPayment(inv)}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              دفع
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => handleCancelInvoice(inv.id)}
                              className="inline-flex items-center gap-1 text-xs text-destructive hover:underline px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              إلغاء
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <InvoiceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => router.refresh()}
        tenants={tenants}
        contracts={contracts}
      />

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onSuccess={() => router.refresh()}
        invoice={paymentInvoice}
      />
    </div>
  )
}
