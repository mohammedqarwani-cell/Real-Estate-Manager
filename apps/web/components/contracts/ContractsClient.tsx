'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, differenceInDays } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Plus, FileText, AlertTriangle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ContractFormDialog } from './ContractFormDialog'
import type { Contract, Tenant, Unit, Property, ContractStatus } from '@repo/types'

// ─── Constants ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ContractStatus, { label: string; className: string; dotClass: string }> = {
  draft:      { label: 'مسودة',  className: 'bg-gray-100 text-gray-600',    dotClass: 'bg-gray-400'   },
  active:     { label: 'ساري',   className: 'bg-green-100 text-green-700',  dotClass: 'bg-green-500'  },
  expired:    { label: 'منتهي',  className: 'bg-red-100 text-red-700',      dotClass: 'bg-red-500'    },
  terminated: { label: 'مُنهى', className: 'bg-orange-100 text-orange-700', dotClass: 'bg-orange-500' },
  renewed:    { label: 'مجدد',   className: 'bg-blue-100 text-blue-700',    dotClass: 'bg-blue-500'   },
}

function paymentMethodLabel(contract: ContractWithRelations): string {
  const count = (contract as any).payment_count
  if (!count || count === 0) {
    const cycle = (contract as any).payment_cycle ?? 'monthly'
    return cycle === 'monthly' ? 'شهري' : cycle === 'quarterly' ? 'ربعي' : 'سنوي'
  }
  if (count === 1)  return 'دفعة واحدة'
  if (count === 2)  return 'دفعتان'
  if (count === 12) return 'شهري (12)'
  return `${count} دفعات`
}

// ─── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContractStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────

type UnitWithProperty = Unit & { property: Pick<Property, 'id' | 'name'> }

export type ContractWithRelations = Contract & {
  tenant: Pick<Tenant, 'id' | 'full_name' | 'company_name' | 'phone'> | null
  unit: UnitWithProperty | null
}

interface ContractsClientProps {
  contracts: ContractWithRelations[]
  availableUnits: UnitWithProperty[]
  tenants: Tenant[]
  properties: Pick<Property, 'id' | 'name'>[]
}

// ─── Main Component ────────────────────────────────────────────────────────

export function ContractsClient({
  contracts,
  availableUnits,
  tenants,
  properties,
}: ContractsClientProps) {
  const router = useRouter()

  // ─── عروض الأعمدة (px) — قابلة للسحب ─────────────────────────────────────
  const [colWidths, setColWidths] = useState([200, 130, 100, 110, 130, 110, 95, 95, 60])
  const resizingRef = useRef<{ colIdx: number; startX: number; startW: number } | null>(null)

  const startResize = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = { colIdx, startX: e.clientX, startW: colWidths[colIdx] }

    function onMove(ev: MouseEvent) {
      if (!resizingRef.current) return
      const delta = resizingRef.current.startX - ev.clientX   // RTL: سحب يساراً يزيد العرض
      const newW  = Math.max(60, resizingRef.current.startW + delta)
      setColWidths((prev) => prev.map((w, i) => (i === resizingRef.current!.colIdx ? newW : w)))
    }

    function onUp() {
      resizingRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [colWidths])

  const [dialogOpen, setDialogOpen]           = useState(false)
  const [statusFilter, setStatusFilter]       = useState<string>('all')
  const [propertyFilter, setPropertyFilter]   = useState<string>('all')
  const [tenantFilter, setTenantFilter]       = useState<string>('all')
  const [contractTypeFilter, setContractTypeFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    let data = contracts
    if (statusFilter !== 'all') data = data.filter((c) => c.status === statusFilter)
    if (propertyFilter !== 'all')
      data = data.filter((c) => (c.unit as any)?.property?.id === propertyFilter)
    if (tenantFilter !== 'all') data = data.filter((c) => c.tenant_id === tenantFilter)
    if (contractTypeFilter !== 'all')
      data = data.filter((c) => (c as any).contract_type === contractTypeFilter)
    return data
  }, [contracts, statusFilter, propertyFilter, tenantFilter, contractTypeFilter])

  const expiringCount = useMemo(
    () =>
      contracts.filter((c) => {
        if (c.status !== 'active') return false
        const days = differenceInDays(new Date(c.end_date), new Date())
        return days >= 0 && days <= 30
      }).length,
    [contracts]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">العقود</h1>
            {expiringCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                <AlertTriangle className="h-3 w-3" />
                {expiringCount} تنتهي قريباً
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {contracts.length} عقد إجمالاً • {contracts.filter((c) => c.status === 'active').length} ساري
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="shrink-0 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          إنشاء عقد
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center" dir="rtl">
        {/* Status filter buttons */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'expired', 'terminated', 'draft', 'renewed'] as const).map((s) => {
            const count = s === 'all' ? contracts.length : contracts.filter((c) => c.status === s).length
            const cfg = s !== 'all' ? STATUS_CONFIG[s] : null
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  statusFilter === s
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {cfg && <span className={`h-2 w-2 rounded-full ${cfg.dotClass}`} />}
                {s === 'all' ? 'الكل' : cfg?.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === s ? 'bg-background/20' : 'bg-muted'}`}>
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

        {/* Tenant filter */}
        {tenants.length > 0 && (
          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="كل المستأجرين" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المستأجرين</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.company_name || t.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Contract type filter */}
        <div className="flex gap-2">
          {([
            { value: 'all',       label: 'الكل' },
            { value: 'full_time', label: '🔵 دوام كامل' },
            { value: 'part_time', label: '🟡 دوام جزئي' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setContractTypeFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                contractTypeFilter === opt.value
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {contracts.length === 0 ? 'لا توجد عقود بعد' : 'لا توجد نتائج مطابقة'}
            </p>
            {contracts.length === 0 && (
              <Button onClick={() => setDialogOpen(true)} className="mt-4" variant="outline">
                <Plus className="h-4 w-4" />
                إنشاء أول عقد
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm table-fixed" style={{ width: colWidths.reduce((a, b) => a + b, 0) + 'px', minWidth: '100%' }}>
              <colgroup>
                {colWidths.map((w, i) => <col key={i} style={{ width: w + 'px' }} />)}
              </colgroup>
              <thead>
                <tr className="border-b bg-muted/40">
                  {([
                    'المستأجر', 'الوحدة', 'البداية', 'النهاية',
                    'إجمالي الإيجار', 'الدفعة', 'النوع', 'الحالة', '',
                  ] as const).map((label, i) => (
                    <th
                      key={i}
                      className="relative px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide select-none"
                      style={{ width: colWidths[i] + 'px' }}
                    >
                      <span className="whitespace-nowrap">{label}</span>
                      {/* handle السحب — على الحافة اليسرى (RTL) */}
                      {i < 8 && (
                        <span
                          onMouseDown={(e) => startResize(i, e)}
                          className="absolute top-0 left-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors group-hover:bg-primary/20"
                          title="اسحب لتغيير العرض"
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const daysLeft = differenceInDays(new Date(c.end_date), new Date())
                  const isExpiringSoon = c.status === 'active' && daysLeft >= 0 && daysLeft <= 30
                  return (
                    <tr key={c.id} className="group border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3 font-medium truncate max-w-0">
                        <div className="truncate">
                          {c.tenant ? (c.tenant.company_name || c.tenant.full_name) : '—'}
                        </div>
                        {c.tenant?.company_name && (
                          <div className="text-xs text-muted-foreground truncate">{c.tenant.full_name}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 max-w-0">
                        <div className="font-medium truncate">وحدة {c.unit?.unit_number ?? '—'}</div>
                        <div className="text-xs text-muted-foreground truncate">{(c.unit as any)?.property?.name ?? ''}</div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {format(new Date(c.start_date), 'dd MMM yyyy', { locale: ar })}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs">
                        <div className={isExpiringSoon ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                          {format(new Date(c.end_date), 'dd MMM yyyy', { locale: ar })}
                        </div>
                        {isExpiringSoon && (
                          <div className="text-xs text-amber-500 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            {daysLeft === 0 ? 'ينتهي اليوم' : `${daysLeft} يوم`}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold whitespace-nowrap">
                          {((c as any).total_amount > 0
                            ? Number((c as any).total_amount)
                            : c.monthly_rent * 12
                          ).toLocaleString('ar-AE')} د.إ
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        <div className="whitespace-nowrap text-xs font-medium">
                          {(c as any).payment_amount > 0
                            ? `${Number((c as any).payment_amount).toLocaleString('ar-AE')} د.إ`
                            : `${c.monthly_rent.toLocaleString('ar-AE')} د.إ`
                          }
                        </div>
                        <div className="text-xs text-muted-foreground/70 whitespace-nowrap">
                          {paymentMethodLabel(c)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {(c as any).contract_type === 'part_time' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 whitespace-nowrap">
                            🟡 جزئي
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap">
                            🔵 كامل
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/dashboard/contracts/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          تفاصيل
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ContractFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => router.refresh()}
        availableUnits={availableUnits}
        tenants={tenants}
      />
    </div>
  )
}
