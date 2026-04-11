'use client'

import { useState, useMemo } from 'react'
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

const PAYMENT_CYCLE_LABELS: Record<string, string> = {
  monthly: 'شهري',
  quarterly: 'ربعي',
  annually: 'سنوي',
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
  tenant: Pick<Tenant, 'id' | 'full_name' | 'phone'> | null
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
  const [dialogOpen, setDialogOpen]       = useState(false)
  const [statusFilter, setStatusFilter]   = useState<string>('all')
  const [propertyFilter, setPropertyFilter] = useState<string>('all')
  const [tenantFilter, setTenantFilter]   = useState<string>('all')

  const filtered = useMemo(() => {
    let data = contracts
    if (statusFilter !== 'all') data = data.filter((c) => c.status === statusFilter)
    if (propertyFilter !== 'all')
      data = data.filter((c) => (c.unit as any)?.property?.id === propertyFilter)
    if (tenantFilter !== 'all') data = data.filter((c) => c.tenant_id === tenantFilter)
    return data
  }, [contracts, statusFilter, propertyFilter, tenantFilter])

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
                <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">المستأجر</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">الوحدة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">تاريخ البداية</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">تاريخ النهاية</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">الإيجار</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">دورة الدفع</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">الحالة</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const daysLeft = differenceInDays(new Date(c.end_date), new Date())
                  const isExpiringSoon = c.status === 'active' && daysLeft >= 0 && daysLeft <= 30
                  return (
                    <tr key={c.id} className="group border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {c.tenant?.full_name ?? '—'}
                        {c.tenant?.phone && (
                          <div className="text-xs text-muted-foreground">{c.tenant.phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">وحدة {c.unit?.unit_number ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{(c.unit as any)?.property?.name ?? ''}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(c.start_date), 'dd MMM yyyy', { locale: ar })}
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 font-semibold">
                        {c.monthly_rent.toLocaleString('ar-AE')} د.إ
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {PAYMENT_CYCLE_LABELS[(c as any).payment_cycle ?? 'monthly'] ?? 'شهري'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/contracts/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
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
