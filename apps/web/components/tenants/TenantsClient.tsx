'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Phone, Mail, CreditCard,
  Users, FileText, ChevronUp, ChevronDown, ArrowUpDown,
} from 'lucide-react'
import type { Tenant, TenantStatus } from '@repo/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TenantFormDialog } from './TenantFormDialog'

// ─── Constants ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TenantStatus, { label: string; className: string; dotClass: string }> = {
  active:      { label: 'نشط',      className: 'bg-green-100 text-green-700', dotClass: 'bg-green-500' },
  inactive:    { label: 'غير نشط', className: 'bg-gray-100 text-gray-600',   dotClass: 'bg-gray-400'  },
  blacklisted: { label: 'محظور',    className: 'bg-red-100 text-red-700',     dotClass: 'bg-red-500'   },
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type TenantWithContractCount = Tenant & { active_contracts: number }

interface TenantsClientProps {
  tenants: TenantWithContractCount[]
}

type SortKey = 'full_name' | 'active_contracts' | null
type SortDir = 'asc' | 'desc'

// ─── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TenantStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  )
}

// ─── Sort Icon ─────────────────────────────────────────────────────────────

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
  return sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
}

// ─── Main Component ────────────────────────────────────────────────────────

export function TenantsClient({ tenants }: TenantsClientProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen]     = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch]             = useState('')
  const [sortKey, setSortKey]           = useState<SortKey>(null)
  const [sortDir, setSortDir]           = useState<SortDir>('asc')

  function handleAdd() { setDialogOpen(true) }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let data: TenantWithContractCount[] =
      statusFilter === 'all' ? tenants : tenants.filter((t) => t.status === statusFilter)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      data = data.filter(
        (t) =>
          t.full_name.toLowerCase().includes(q) ||
          t.email?.toLowerCase().includes(q) ||
          t.phone?.toLowerCase().includes(q) ||
          t.national_id?.toLowerCase().includes(q) ||
          t.company_name?.toLowerCase().includes(q)
      )
    }

    if (sortKey) {
      data = [...data].sort((a, b) => {
        const av = sortKey === 'active_contracts'
          ? a.active_contracts
          : (a.company_name || a.full_name).toLowerCase()
        const bv = sortKey === 'active_contracts'
          ? b.active_contracts
          : (b.company_name || b.full_name).toLowerCase()
        if (av < bv) return sortDir === 'asc' ? -1 : 1
        if (av > bv) return sortDir === 'asc' ? 1 : -1
        return 0
      })
    }

    return data
  }, [tenants, statusFilter, search, sortKey, sortDir])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">المستأجرون</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tenants.length} مستأجر إجمالاً • {tenants.filter((t) => t.status === 'active').length} نشط
          </p>
        </div>
        <Button onClick={handleAdd} className="shrink-0 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          إضافة مستأجر
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3" dir="rtl">
        <Input
          placeholder="بحث بالاسم، الهاتف، الإيميل، رقم الهوية..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'inactive', 'blacklisted'] as const).map((s) => {
            const count = s === 'all' ? tenants.length : tenants.filter((t) => t.status === s).length
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
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {tenants.length === 0 ? 'لا يوجد مستأجرون مضافون بعد' : 'لا توجد نتائج مطابقة'}
            </p>
            {tenants.length === 0 && (
              <Button onClick={handleAdd} className="mt-4" variant="outline">
                <Plus className="h-4 w-4" />
                إضافة أول مستأجر
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <button className="flex items-center gap-1 font-semibold" onClick={() => toggleSort('full_name')}>
                      المستأجر
                      <SortIcon col="full_name" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">الهاتف</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">البريد الإلكتروني</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">رقم الهوية</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <button className="flex items-center gap-1 font-semibold" onClick={() => toggleSort('active_contracts')}>
                      العقود الفعّالة
                      <SortIcon col="active_contracts" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="group border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/tenants/${t.id}`} className="font-medium hover:underline hover:text-primary transition-colors">
                        {t.company_name || t.full_name}
                      </Link>
                      {t.company_name && (
                        <div className="text-xs text-muted-foreground">{t.full_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.phone ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{t.phone}</span>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {t.email ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[180px]">{t.email}</span>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {t.national_id ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CreditCard className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-mono text-sm">{t.national_id}</span>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className={`font-medium ${t.active_contracts > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {t.active_contracts}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TenantFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => { setDialogOpen(false); router.refresh() }}
      />
    </div>
  )
}
