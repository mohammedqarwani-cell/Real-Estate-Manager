'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  ArrowRight, User, Phone, Mail, CreditCard, FileText,
  Paperclip, Upload, Download, Trash2, Loader2, Pencil,
  ChevronLeft, Building2, Calendar, CheckCircle2, Clock,
  AlertCircle, Ban, CreditCard as CreditCardIcon,
} from 'lucide-react'
import { DeleteTenantDialog } from './DeleteTenantDialog'
import { toast } from 'sonner'
import type { Tenant, TenantStatus, ContractStatus, InvoiceStatus } from '@repo/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { TenantFormDialog } from './TenantFormDialog'
import {
  saveTenantNotes,
  uploadTenantDocumentForDetail,
  deleteTenantDocumentForDetail,
} from '@/app/(dashboard)/dashboard/tenants/actions'

// ─── Types ──────────────────────────────────────────────────────────────────

type ContractRow = {
  id: string
  status: ContractStatus
  start_date: string
  end_date: string
  monthly_rent: number
  payment_cycle: string | null
  total_amount?: number
  created_at: string
  unit: {
    id: string
    unit_number: string
    floor: number | null
    type: string | null
    property: { id: string; name: string } | null
  } | null
}

type InvoiceRow = {
  id: string
  invoice_number: string
  type: string
  total_amount: number
  status: InvoiceStatus
  due_date: string
  created_at: string
}

interface Props {
  tenant: Tenant
  contracts: ContractRow[]
  invoices: InvoiceRow[]
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TENANT_STATUS: Record<TenantStatus, { label: string; className: string }> = {
  active:      { label: 'نشط',      className: 'bg-green-100 text-green-700' },
  inactive:    { label: 'غير نشط', className: 'bg-gray-100  text-gray-600'  },
  blacklisted: { label: 'محظور',    className: 'bg-red-100   text-red-700'   },
}

const CONTRACT_STATUS: Record<ContractStatus, { label: string; className: string }> = {
  draft:      { label: 'مسودة',  className: 'bg-gray-100   text-gray-700'    },
  active:     { label: 'ساري',   className: 'bg-green-100  text-green-700'   },
  expired:    { label: 'منتهي',  className: 'bg-red-100    text-red-700'     },
  terminated: { label: 'مُنهى', className: 'bg-orange-100 text-orange-700'  },
  renewed:    { label: 'مجدد',   className: 'bg-blue-100   text-blue-700'    },
}

const INVOICE_STATUS: Record<InvoiceStatus, { label: string; className: string; Icon: React.ElementType }> = {
  draft:     { label: 'مسودة',           className: 'bg-gray-100   text-gray-600',    Icon: Clock          },
  pending:   { label: 'معلقة',            className: 'bg-yellow-100 text-yellow-700',  Icon: Clock          },
  paid:      { label: 'مدفوعة',          className: 'bg-green-100  text-green-700',   Icon: CheckCircle2   },
  overdue:   { label: 'متأخرة',          className: 'bg-red-100    text-red-700',     Icon: AlertCircle    },
  partial:   { label: 'مدفوعة جزئياً',  className: 'bg-orange-100 text-orange-700',  Icon: CreditCardIcon },
  cancelled: { label: 'ملغاة',           className: 'bg-gray-100   text-gray-500',    Icon: Ban            },
}

const INVOICE_TYPE_LABELS: Record<string, string> = {
  rent: 'إيجار', maintenance: 'صيانة', utility: 'خدمات', deposit: 'تأمين', other: 'أخرى',
}

const PAYMENT_CYCLE_LABELS: Record<string, string> = {
  monthly: 'شهري', quarterly: 'ربعي', annually: 'سنوي',
}

const ALLOWED_TYPES = ['pdf', 'jpg', 'jpeg', 'png']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDocUrl(url: string) {
  const filename = url.split('/').pop() ?? 'file'
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const tsMatch = filename.match(/^(\d{13})/)
  const uploadedAt = tsMatch ? new Date(parseInt(tsMatch[1])) : null
  return { filename, ext, uploadedAt }
}

function DocTypeBadge({ ext }: { ext: string }) {
  const colors: Record<string, string> = {
    pdf:  'bg-red-100  text-red-700',
    jpg:  'bg-blue-100 text-blue-700',
    jpeg: 'bg-blue-100 text-blue-700',
    png:  'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${colors[ext] ?? 'bg-gray-100 text-gray-600'}`}>
      {ext}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TenantDetailClient({ tenant, contracts, invoices }: Props) {
  const router = useRouter()

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Documents state (local for optimistic updates)
  const [docs, setDocs] = useState<string[]>(tenant.documents ?? [])
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null)
  const [isUploading, startUploadTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Notes auto-save
  const [notes, setNotes] = useState(tenant.notes ?? '')
  const [notesSaveStatus, setNotesSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Handlers ────────────────────────────────────────────────────────────

  function handleNotesChange(value: string) {
    setNotes(value)
    setNotesSaveStatus('saving')
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(async () => {
      const result = await saveTenantNotes(tenant.id, value)
      if (result.success) {
        setNotesSaveStatus('saved')
        setTimeout(() => setNotesSaveStatus('idle'), 2000)
      } else {
        setNotesSaveStatus('idle')
        toast.error('فشل حفظ الملاحظات')
      }
    }, 800)
  }

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_TYPES.includes(ext)) {
      toast.error('يُسمح فقط بملفات PDF, JPG, PNG')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    startUploadTransition(async () => {
      const result = await uploadTenantDocumentForDetail(tenant.id, fd)
      if (result.success && result.url) {
        setDocs((prev) => [result.url!, ...prev])
        toast.success('تم رفع الملف')
      } else {
        toast.error(result.error ?? 'فشل رفع الملف')
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
  }

  async function handleDeleteDoc(url: string) {
    if (!confirm('هل أنت متأكد من حذف هذا الملف؟')) return
    setDeletingUrl(url)
    const result = await deleteTenantDocumentForDetail(tenant.id, url)
    if (result.success) {
      setDocs((prev) => prev.filter((d) => d !== url))
      toast.success('تم حذف الملف')
    } else {
      toast.error(result.error ?? 'فشل حذف الملف')
    }
    setDeletingUrl(null)
  }

  const statusCfg = TENANT_STATUS[tenant.status]

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard/tenants" className="hover:text-foreground transition-colors">
          المستأجرون
        </Link>
        <ChevronLeft className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{tenant.company_name || tenant.full_name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.back()}
            className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="h-4 w-4" />
            رجوع
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{tenant.company_name || tenant.full_name}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.className}`}>
                {statusCfg.label}
              </span>
            </div>
            {tenant.company_name && (
              <p className="text-sm text-muted-foreground mt-0.5">{tenant.full_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Button onClick={() => setEditOpen(true)} variant="outline">
            <Pencil className="h-4 w-4" />
            تعديل البيانات
          </Button>
          <Button onClick={() => setDeleteOpen(true)} variant="destructive">
            <Trash2 className="h-4 w-4" />
            حذف المستأجر
          </Button>
        </div>
      </div>

      {/* ── Section 1: Personal Info ──────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground mb-4">
          <User className="h-4 w-4" />
          المعلومات الشخصية
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground min-w-[90px]">الاسم الكامل</span>
            <span className="font-medium">{tenant.full_name}</span>
          </div>
          {tenant.national_id && (
            <div className="flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground min-w-[90px]">رقم الهوية</span>
              <span className="font-mono">{tenant.national_id}</span>
            </div>
          )}
          {tenant.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground min-w-[90px]">رقم الموبايل</span>
              <a href={`tel:${tenant.phone}`} className="hover:underline">{tenant.phone}</a>
            </div>
          )}
          {tenant.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground min-w-[90px]">البريد الإلكتروني</span>
              <a href={`mailto:${tenant.email}`} className="hover:underline truncate">{tenant.email}</a>
            </div>
          )}
          {tenant.address && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground min-w-[90px]">العنوان</span>
              <span>{tenant.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Contracts ─────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground px-5 py-4 border-b">
          <FileText className="h-4 w-4" />
          العقود
          <span className="mr-auto text-xs bg-muted px-2 py-0.5 rounded-full">{contracts.length}</span>
        </div>
        {contracts.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">لا توجد عقود لهذا المستأجر</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-right font-semibold">الوحدة</th>
                  <th className="px-4 py-2.5 text-right font-semibold">تاريخ البداية</th>
                  <th className="px-4 py-2.5 text-right font-semibold">تاريخ النهاية</th>
                  <th className="px-4 py-2.5 text-right font-semibold">الإيجار</th>
                  <th className="px-4 py-2.5 text-right font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const cs = CONTRACT_STATUS[c.status]
                  const rentLabel = c.total_amount && c.total_amount > 0
                    ? `${Number(c.total_amount).toLocaleString('ar-AE')} د.إ / ${PAYMENT_CYCLE_LABELS[c.payment_cycle ?? ''] ?? 'شهري'}`
                    : `${Number(c.monthly_rent).toLocaleString('ar-AE')} د.إ / شهر`
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/dashboard/contracts/${c.id}`)}
                      className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">وحدة {c.unit?.unit_number ?? '—'}</div>
                        {c.unit?.property?.name && (
                          <div className="text-xs text-muted-foreground">{c.unit.property.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(c.start_date), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(c.end_date), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-3 font-medium">{rentLabel}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cs.className}`}>
                          {cs.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 3: Invoices ──────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground px-5 py-4 border-b">
          <Calendar className="h-4 w-4" />
          آخر الفواتير
          <Link
            href={`/dashboard/invoices?search=${encodeURIComponent(tenant.full_name)}`}
            onClick={(e) => e.stopPropagation()}
            className="mr-auto text-xs text-primary hover:underline font-medium"
          >
            عرض كل الفواتير ←
          </Link>
        </div>
        {invoices.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">لا توجد فواتير لهذا المستأجر</div>
        ) : (
          <div className="divide-y">
            {invoices.map((inv) => {
              const is = INVOICE_STATUS[inv.status]
              const Icon = is.Icon
              return (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">{inv.invoice_number}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="text-sm">{INVOICE_TYPE_LABELS[inv.type] ?? inv.type}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      {Number(inv.total_amount).toLocaleString('ar-AE')} د.إ
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {format(new Date(inv.due_date), 'dd/MM/yyyy')}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${is.className}`}>
                      <Icon className="h-3 w-3" />
                      {is.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section 4: Documents ─────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground px-5 py-4 border-b">
          <Paperclip className="h-4 w-4" />
          الملفات والمستندات
          <span className="mr-auto text-xs bg-muted px-2 py-0.5 rounded-full">{docs.length}</span>
          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            رفع ملف جديد
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {docs.length === 0 ? (
          <div className="py-10 text-center">
            <Paperclip className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد ملفات مرفوعة</p>
            <button
              onClick={handleUploadClick}
              disabled={isUploading}
              className="mt-3 text-xs text-primary hover:underline disabled:opacity-50"
            >
              رفع أول ملف
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {docs.map((url) => {
              const { filename, ext, uploadedAt } = parseDocUrl(url)
              const isDeleting = deletingUrl === url
              return (
                <div
                  key={url}
                  className={`flex items-center gap-3 px-5 py-3 transition-opacity ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <DocTypeBadge ext={ext} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{filename}</p>
                    {uploadedAt && (
                      <p className="text-xs text-muted-foreground">
                        {format(uploadedAt, 'dd MMMM yyyy', { locale: ar })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
                      title="تحميل"
                    >
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </a>
                    <button
                      onClick={() => handleDeleteDoc(url)}
                      disabled={isDeleting}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="حذف"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section 5: Notes ─────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            ملاحظات
          </div>
          <div className="text-xs text-muted-foreground h-4">
            {notesSaveStatus === 'saving' && (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> جاري الحفظ...
              </span>
            )}
            {notesSaveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" /> تم الحفظ
              </span>
            )}
          </div>
        </div>
        <Textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="أضف ملاحظات على هذا المستأجر..."
          className="min-h-[100px] resize-none"
          dir="rtl"
        />
      </div>

      {/* Edit Dialog */}
      <TenantFormDialog
        open={editOpen}
        onOpenChange={(open) => setEditOpen(open)}
        tenant={tenant}
        onSuccess={() => {
          setEditOpen(false)
          router.refresh()
        }}
      />

      {/* Delete Dialog */}
      <DeleteTenantDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tenantId={tenant.id}
        tenantName={tenant.full_name}
        onSuccess={() => router.push('/dashboard/tenants')}
      />
    </div>
  )
}
