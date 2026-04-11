'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { Plus, Pencil, Eye, ArrowUpDown, ChevronUp, ChevronDown, Home } from 'lucide-react'
import { toast } from 'sonner'
import type { Unit, Contract, MaintenanceRequest, Tenant, UnitStatus } from '@repo/types'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UnitFormDialog } from './UnitFormDialog'
import { UnitDetailDialog } from './UnitDetailDialog'
import { OccupancyWidget } from './OccupancyWidget'
import { updateUnitStatus } from '@/app/(dashboard)/dashboard/properties/[id]/units/actions'

// ─── Constants ─────────────────────────────────────────────────────────────

const UNIT_TYPE_LABELS: Record<string, string> = {
  apartment: 'شقة',
  office: 'مكتب',
  retail: 'محل تجاري',
  studio: 'استوديو',
  villa: 'فيلا',
  warehouse: 'مستودع',
}

const STATUS_CONFIG: Record<
  UnitStatus,
  { label: string; className: string; dotClass: string }
> = {
  available: {
    label: 'متاح',
    className: 'bg-green-100 text-green-700',
    dotClass: 'bg-green-500',
  },
  occupied: {
    label: 'مؤجر',
    className: 'bg-red-100 text-red-700',
    dotClass: 'bg-red-500',
  },
  maintenance: {
    label: 'صيانة',
    className: 'bg-orange-100 text-orange-700',
    dotClass: 'bg-orange-500',
  },
  reserved: {
    label: 'محجوز',
    className: 'bg-yellow-100 text-yellow-700',
    dotClass: 'bg-yellow-500',
  },
}

// ─── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: UnitStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-600', dotClass: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────

type ContractWithTenant = Contract & {
  tenant: Pick<Tenant, 'id' | 'full_name' | 'email' | 'phone'> | null
}

interface UnitsClientProps {
  propertyId: string
  propertyName: string
  units: Unit[]
  contracts: ContractWithTenant[]
  maintenanceRequests: MaintenanceRequest[]
}

// ─── Column Helper ─────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Unit>()

// ─── Main Component ────────────────────────────────────────────────────────

export function UnitsClient({
  propertyId,
  propertyName,
  units,
  contracts,
  maintenanceRequests,
}: UnitsClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [isPending, startTransition] = useTransition()
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null)

  // Compute active contract per unit
  const activeContractByUnit = useMemo(() => {
    const map = new Map<string, ContractWithTenant>()
    for (const c of contracts) {
      if (c.status === 'active' && c.unit_id) {
        if (!map.has(c.unit_id)) map.set(c.unit_id, c)
      }
    }
    return map
  }, [contracts])

  // Filter units by status
  const filteredUnits = useMemo(() => {
    if (statusFilter === 'all') return units
    return units.filter((u) => u.status === statusFilter)
  }, [units, statusFilter])

  function handleEdit(unit: Unit) {
    setEditingUnit(unit)
    setDialogOpen(true)
  }

  function handleAdd() {
    setEditingUnit(null)
    setDialogOpen(true)
  }

  function handleViewDetail(unit: Unit) {
    setDetailUnit(unit)
    setDetailOpen(true)
  }

  function handleStatusChange(unitId: string, newStatus: UnitStatus) {
    setChangingStatusId(unitId)
    startTransition(async () => {
      const result = await updateUnitStatus(unitId, propertyId, newStatus)
      if (result.success) {
        toast.success('تم تحديث حالة الوحدة')
      } else {
        toast.error(result.error ?? 'حدث خطأ')
      }
      setChangingStatusId(null)
    })
  }

  // ─── Columns ──────────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      columnHelper.accessor('unit_number', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 font-semibold"
            onClick={() => column.toggleSorting()}
          >
            رقم الوحدة
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
            )}
          </button>
        ),
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue()}</span>
        ),
      }),
      columnHelper.accessor('floor', {
        header: 'الطابق',
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? <span>{v}</span> : <span className="text-muted-foreground">—</span>
        },
      }),
      columnHelper.accessor('type', {
        header: 'النوع',
        cell: ({ getValue }) => {
          const v = getValue()
          return v ? (
            <span>{UNIT_TYPE_LABELS[v] ?? v}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      }),
      columnHelper.accessor('area', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 font-semibold"
            onClick={() => column.toggleSorting()}
          >
            المساحة
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
            )}
          </button>
        ),
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? (
            <span>{v.toLocaleString('ar-AE')} م²</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      }),
      columnHelper.accessor('monthly_rent', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 font-semibold"
            onClick={() => column.toggleSorting()}
          >
            الإيجار الشهري
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
            )}
          </button>
        ),
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? (
            <span className="font-semibold">{v.toLocaleString('ar-AE')} د.إ</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      }),
      columnHelper.accessor('status', {
        header: 'الحالة',
        cell: ({ row, getValue }) => {
          const unit = row.original
          const isChanging = changingStatusId === unit.id
          return (
            <div className="flex items-center gap-2">
              <StatusBadge status={getValue()} />
              <Select
                value={getValue()}
                onValueChange={(v) => handleStatusChange(unit.id, v as UnitStatus)}
                disabled={isChanging || isPending}
              >
                <SelectTrigger className="h-7 w-7 p-0 border-0 bg-transparent shadow-none [&>svg]:hidden opacity-0 group-hover/row:opacity-100 transition-opacity">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">متاح</SelectItem>
                  <SelectItem value="occupied">مؤجر</SelectItem>
                  <SelectItem value="maintenance">صيانة</SelectItem>
                  <SelectItem value="reserved">محجوز</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const unit = row.original
          return (
            <div className="flex items-center gap-1 justify-end opacity-0 group-hover/row:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => handleViewDetail(unit)}
                title="عرض التفاصيل"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => handleEdit(unit)}
                title="تعديل"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )
        },
      }),
    ],
    [changingStatusId, isPending] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const table = useReactTable({
    data: filteredUnits,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">وحدات {propertyName}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {units.length} وحدة إجمالاً
          </p>
        </div>
        <Button onClick={handleAdd} className="shrink-0 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          إضافة وحدة
        </Button>
      </div>

      {/* Occupancy Widget */}
      <OccupancyWidget units={units} />

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'available', 'occupied', 'maintenance', 'reserved'] as const).map((s) => {
          const count =
            s === 'all' ? units.length : units.filter((u) => u.status === s).length
          const isActive = statusFilter === s
          const cfg = s !== 'all' ? STATUS_CONFIG[s] : null

          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                isActive
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {cfg && (
                <span className={`h-2 w-2 rounded-full ${cfg.dotClass}`} />
              )}
              {s === 'all' ? 'الكل' : cfg?.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-background/20' : 'bg-muted'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {filteredUnits.length === 0 ? (
          <div className="py-16 text-center">
            <Home className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {units.length === 0
                ? 'لا توجد وحدات مضافة بعد'
                : 'لا توجد وحدات بهذه الحالة'}
            </p>
            {units.length === 0 && (
              <Button onClick={handleAdd} className="mt-4" variant="outline">
                <Plus className="h-4 w-4" />
                إضافة أول وحدة
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b bg-muted/40">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="group/row border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <UnitFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingUnit(null)
        }}
        propertyId={propertyId}
        unit={editingUnit}
      />

      {/* Detail Dialog */}
      {detailUnit && (
        <UnitDetailDialog
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open)
            if (!open) setDetailUnit(null)
          }}
          unit={detailUnit}
          activeContract={activeContractByUnit.get(detailUnit.id) ?? null}
          contracts={contracts.filter((c) => c.unit_id === detailUnit.id)}
          maintenanceRequests={maintenanceRequests.filter(
            (m) => m.unit_id === detailUnit.id
          )}
          onEdit={() => {
            setDetailOpen(false)
            setEditingUnit(detailUnit)
            setDialogOpen(true)
          }}
        />
      )}
    </div>
  )
}
