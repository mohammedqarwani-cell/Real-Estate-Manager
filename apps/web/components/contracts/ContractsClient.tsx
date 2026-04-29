'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, differenceInDays } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  Plus, FileText, AlertTriangle, ExternalLink,
  Search, SlidersHorizontal, X, ChevronUp, ChevronDown, ArrowUpDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
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

  // ─── عرض عمود الاسم — قابل للسحب فقط ────────────────────────────────────
  const [nameColWidth, setNameColWidth] = useState(200)
  const resizingRef = useRef<{ startX: number; startW: number } | null>(null)

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = { startX: e.clientX, startW: nameColWidth }

    function onMove(ev: MouseEvent) {
      if (!resizingRef.current) return
      const delta = resizingRef.current.startX - ev.clientX  // RTL
      const newW  = Math.max(80, resizingRef.current.startW + delta)
      setNameColWidth(newW)
    }

    function onUp() {
      resizingRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [nameColWidth])

  const [dialogOpen, setDialogOpen]                 = useState(false)
  const [showAdvanced, setShowAdvanced]             = useState(false)

  // ─── فلاتر ────────────────────────────────────────────────────────────────
  const [search, setSearch]                         = useState('')
  const [statusFilter, setStatusFilter]             = useState<string>('all')
  const [propertyFilter, setPropertyFilter]         = useState<string>('all')
  const [tenantFilter, setTenantFilter]             = useState<string>('all')
  const [contractTypeFilter, setContractTypeFilter] = useState<string>('all')
  const [expiringFilter, setExpiringFilter]         = useState<number | null>(null) // أيام
  const [startFrom, setStartFrom]                   = useState('')
  const [startTo, setStartTo]                       = useState('')
  const [endFrom, setEndFrom]                       = useState('')
  const [endTo, setEndTo]                           = useState('')
  const [amountMin, setAmountMin]                   = useState('')
  const [amountMax, setAmountMax]                   = useState('')

  // ─── ترتيب ────────────────────────────────────────────────────────────────
  type SortKey = 'tenant' | 'start_date' | 'end_date' | 'total_amount' | null
  type SortDir = 'asc' | 'desc'
  const [sortKey, setSortKey] = useState<SortKey>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  // ─── مسح كل الفلاتر ───────────────────────────────────────────────────────
  function clearAll() {
    setSearch(''); setStatusFilter('all'); setPropertyFilter('all')
    setTenantFilter('all'); setContractTypeFilter('all'); setExpiringFilter(null)
    setStartFrom(''); setStartTo(''); setEndFrom(''); setEndTo('')
    setAmountMin(''); setAmountMax(''); setSortKey(null); setSortDir('asc')
  }

  const hasActiveFilters = search || statusFilter !== 'all' || propertyFilter !== 'all' ||
    tenantFilter !== 'all' || contractTypeFilter !== 'all' || expiringFilter !== null ||
    startFrom || startTo || endFrom || endTo || amountMin || amountMax

  // ─── منطق الفلترة والترتيب ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = contracts

    // بحث نصي: اسم المستأجر، اسم الشركة، رقم الوحدة، اسم العقار
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      data = data.filter((c) =>
        c.tenant?.full_name?.toLowerCase().includes(q) ||
        c.tenant?.company_name?.toLowerCase().includes(q) ||
        c.unit?.unit_number?.toLowerCase().includes(q) ||
        (c.unit as any)?.property?.name?.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') data = data.filter((c) => c.status === statusFilter)
    if (propertyFilter !== 'all')
      data = data.filter((c) => (c.unit as any)?.property?.id === propertyFilter)
    if (tenantFilter !== 'all') data = data.filter((c) => c.tenant_id === tenantFilter)
    if (contractTypeFilter !== 'all')
      data = data.filter((c) => (c as any).contract_type === contractTypeFilter)

    // فلتر "تنتهي قريباً"
    if (expiringFilter !== null) {
      data = data.filter((c) => {
        if (c.status !== 'active') return false
        const days = differenceInDays(new Date(c.end_date), new Date())
        return days >= 0 && days <= expiringFilter
      })
    }

    // نطاق تاريخ البداية
    if (startFrom) data = data.filter((c) => c.start_date >= startFrom)
    if (startTo)   data = data.filter((c) => c.start_date <= startTo)

    // نطاق تاريخ النهاية
    if (endFrom) data = data.filter((c) => c.end_date >= endFrom)
    if (endTo)   data = data.filter((c) => c.end_date <= endTo)

    // نطاق المبلغ
    const minAmt = parseFloat(amountMin)
    const maxAmt = parseFloat(amountMax)
    if (!isNaN(minAmt)) data = data.filter((c) => {
      const amt = (c as any).total_amount > 0 ? Number((c as any).total_amount) : c.monthly_rent * 12
      return amt >= minAmt
    })
    if (!isNaN(maxAmt)) data = data.filter((c) => {
      const amt = (c as any).total_amount > 0 ? Number((c as any).total_amount) : c.monthly_rent * 12
      return amt <= maxAmt
    })

    // الترتيب
    if (sortKey) {
      data = [...data].sort((a, b) => {
        let av: string | number = ''
        let bv: string | number = ''
        if (sortKey === 'tenant') {
          av = (a.tenant?.company_name || a.tenant?.full_name || '').toLowerCase()
          bv = (b.tenant?.company_name || b.tenant?.full_name || '').toLowerCase()
        } else if (sortKey === 'start_date') { av = a.start_date; bv = b.start_date }
        else if (sortKey === 'end_date')   { av = a.end_date;   bv = b.end_date   }
        else if (sortKey === 'total_amount') {
          av = (a as any).total_amount > 0 ? Number((a as any).total_amount) : a.monthly_rent * 12
          bv = (b as any).total_amount > 0 ? Number((b as any).total_amount) : b.monthly_rent * 12
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1
        if (av > bv) return sortDir === 'asc' ?  1 : -1
        return 0
      })
    }

    return data
  }, [contracts, search, statusFilter, propertyFilter, tenantFilter, contractTypeFilter,
      expiringFilter, startFrom, startTo, endFrom, endTo, amountMin, amountMax, sortKey, sortDir])

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

      {/* ─── شريط الفلاتر ──────────────────────────────────────────────────── */}
      <div className="space-y-3" dir="rtl">

        {/* صف 1: بحث + زر الفلاتر المتقدمة + مسح */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، الوحدة، العقار..."
              className="pr-9 h-9"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`gap-1.5 h-9 ${showAdvanced ? 'border-primary text-primary' : ''}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            فلاتر متقدمة
            {hasActiveFilters && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1 h-9 text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" />
              مسح الكل
            </Button>
          )}
        </div>

        {/* صف 2: فلاتر الحالة */}
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

        {/* صف 3: فلاتر متقدمة (قابل للطي) */}
        {showAdvanced && (
          <div className="rounded-xl border bg-muted/30 p-4 space-y-4">

            {/* صف: العقار + المستأجر + نوع العقد + تنتهي قريباً */}
            <div className="flex flex-wrap gap-3 items-center">
              {properties.length > 0 && (
                <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                  <SelectTrigger className="w-[160px] h-9">
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

              <Select value={tenantFilter} onValueChange={setTenantFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="كل المستأجرين" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المستأجرين</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.company_name || t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* نوع العقد */}
              <div className="flex gap-1.5">
                {([
                  { value: 'all',       label: 'كل الأنواع' },
                  { value: 'full_time', label: '🔵 كامل' },
                  { value: 'part_time', label: '🟡 جزئي' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setContractTypeFilter(opt.value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      contractTypeFilter === opt.value
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* تنتهي قريباً */}
              <div className="flex gap-1.5 items-center">
                <span className="text-xs text-muted-foreground whitespace-nowrap">تنتهي خلال:</span>
                {[30, 60, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setExpiringFilter(expiringFilter === d ? null : d)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      expiringFilter === d
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {d} يوم
                  </button>
                ))}
              </div>
            </div>

            {/* صف: نطاق تاريخ البداية + النهاية */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">تاريخ البداية</p>
                <div className="flex gap-2 items-center">
                  <Input type="date" value={startFrom} onChange={(e) => setStartFrom(e.target.value)} className="h-8 text-xs" />
                  <span className="text-muted-foreground text-xs">←</span>
                  <Input type="date" value={startTo}   onChange={(e) => setStartTo(e.target.value)}   className="h-8 text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">تاريخ النهاية</p>
                <div className="flex gap-2 items-center">
                  <Input type="date" value={endFrom} onChange={(e) => setEndFrom(e.target.value)} className="h-8 text-xs" />
                  <span className="text-muted-foreground text-xs">←</span>
                  <Input type="date" value={endTo}   onChange={(e) => setEndTo(e.target.value)}   className="h-8 text-xs" />
                </div>
              </div>
            </div>

            {/* صف: نطاق المبلغ */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">إجمالي الإيجار (د.إ)</p>
              <div className="flex gap-2 items-center max-w-xs">
                <Input type="number" min="0" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} placeholder="من" className="h-8 text-xs" />
                <span className="text-muted-foreground text-xs">—</span>
                <Input type="number" min="0" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} placeholder="إلى" className="h-8 text-xs" />
              </div>
            </div>

          </div>
        )}

        {/* عداد النتائج */}
        {hasActiveFilters && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} نتيجة من أصل {contracts.length} عقد
          </p>
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
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: nameColWidth + 'px' }} />
                <col className="w-[13%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[13%]" />
                <col className="w-[11%]" />
                <col className="w-[9%]"  />
                <col className="w-[9%]"  />
                <col className="w-[5%]"  />
              </colgroup>
              <thead>
                <tr className="border-b bg-muted/40">
                  {/* عمود الاسم — قابل للسحب + ترتيب */}
                  <th
                    className="relative px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide select-none"
                    style={{ width: nameColWidth + 'px' }}
                  >
                    <button onClick={() => toggleSort('tenant')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      المستأجر
                      {sortKey === 'tenant'
                        ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                        : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                    <span
                      onMouseDown={startResize}
                      className="absolute top-0 left-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 transition-colors"
                      title="اسحب لتغيير العرض"
                    />
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    الوحدة
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    <button onClick={() => toggleSort('start_date')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      البداية
                      {sortKey === 'start_date'
                        ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                        : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    <button onClick={() => toggleSort('end_date')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      النهاية
                      {sortKey === 'end_date'
                        ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                        : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    <button onClick={() => toggleSort('total_amount')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      إجمالي الإيجار
                      {sortKey === 'total_amount'
                        ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                        : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  </th>
                  {(['الدفعة','النوع','الحالة',''] as const).map((label, i) => (
                    <th key={i} className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {label}
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
