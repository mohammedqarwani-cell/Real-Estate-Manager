'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Plus, LayoutGrid, List, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MaintenanceRequestDialog } from './MaintenanceRequestDialog'
import { UpdateStatusDialog } from './UpdateStatusDialog'

// ─── Types ──────────────────────────────────────────────────

interface Property   { id: string; name: string }
interface Unit       { id: string; unit_number: string; property: Property | null }
interface Technician { id: string; full_name: string | null }

interface Request {
  id:             string
  title:          string
  description:    string | null
  category:       string | null
  priority:       string
  status:         string
  assigned_to:    string | null
  actual_cost:    number | null
  notes:          string | null
  images:         string[]
  created_at:     string
  completed_date: string | null
  unit?:          { id: string; unit_number: string; property?: { id: string; name: string } | null } | null
  tenant?:        { id: string; full_name: string; phone?: string | null } | null
}

interface MaintenanceClientProps {
  requests:    Request[]
  properties:  Property[]
  units:       Unit[]
  technicians: Technician[]
}

// ─── Config ─────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; class: string; dot: string }> = {
  low:    { label: 'منخفضة', class: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400' },
  medium: { label: 'متوسطة', class: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  high:   { label: 'عالية',  class: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  urgent: { label: 'عاجلة',  class: 'bg-red-100 text-red-700',       dot: 'bg-red-500' },
}

const STATUS_CONFIG: Record<string, { label: string; class: string; col: string }> = {
  open:        { label: 'مفتوح',       class: 'bg-blue-100 text-blue-700',   col: 'border-blue-300' },
  in_progress: { label: 'قيد التنفيذ', class: 'bg-yellow-100 text-yellow-700', col: 'border-yellow-300' },
  completed:   { label: 'مكتمل',       class: 'bg-green-100 text-green-700', col: 'border-green-300' },
  cancelled:   { label: 'ملغي',        class: 'bg-gray-100 text-gray-500',   col: 'border-gray-200' },
}

const CATEGORY_LABELS: Record<string, string> = {
  plumbing:   'سباكة',
  electrical: 'كهرباء',
  hvac:       'مكيف',
  structural: 'هيكلي',
  cleaning:   'نظافة',
  other:      'أخرى',
}

const KANBAN_COLUMNS = [
  { status: 'open',        title: 'مفتوح',       headerClass: 'bg-blue-50 border-blue-200 text-blue-700' },
  { status: 'in_progress', title: 'قيد التنفيذ', headerClass: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  { status: 'completed',   title: 'مكتمل',       headerClass: 'bg-green-50 border-green-200 text-green-700' },
]

// ─── Component ──────────────────────────────────────────────

export function MaintenanceClient({
  requests,
  properties,
  units,
  technicians,
}: MaintenanceClientProps) {
  const router = useRouter()

  // View
  const [view, setView] = useState<'table' | 'kanban'>('table')

  // Filters
  const [filterProperty, setFilterProperty] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterStatus,   setFilterStatus]   = useState('all')

  // Dialogs
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [updateDialogOpen,  setUpdateDialogOpen]  = useState(false)
  const [selectedRequest,   setSelectedRequest]   = useState<Request | null>(null)

  // Ref to track dialog state (prevents router.refresh while dialog is open)
  const dialogOpenRef = useRef(false)
  useEffect(() => {
    dialogOpenRef.current = requestDialogOpen || updateDialogOpen
  }, [requestDialogOpen, updateDialogOpen])

  // ── Realtime subscription ──────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel('maintenance_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'maintenance_requests' },
        () => {
          toast.info('طلب صيانة جديد وصل!', { duration: 4000 })
          if (!dialogOpenRef.current) {
            router.refresh()
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

  // ── Filtered data ──────────────────────────────────────────
  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (filterStatus   !== 'all' && r.status   !== filterStatus)   return false
      if (filterPriority !== 'all' && r.priority !== filterPriority) return false
      if (filterProperty !== 'all') {
        const propId = (r.unit as any)?.property?.id
        if (propId !== filterProperty) return false
      }
      return true
    })
  }, [requests, filterStatus, filterPriority, filterProperty])

  function openUpdate(req: Request) {
    setSelectedRequest(req)
    setUpdateDialogOpen(true)
  }

  // ─── Table View ─────────────────────────────────────────────

  function TableView() {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground text-xs">
                <th className="text-right px-4 py-3 font-medium">الوحدة</th>
                <th className="text-right px-4 py-3 font-medium">النوع</th>
                <th className="text-right px-4 py-3 font-medium max-w-[240px]">الوصف</th>
                <th className="text-right px-4 py-3 font-medium">الأولوية</th>
                <th className="text-right px-4 py-3 font-medium">الحالة</th>
                <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    <Wrench className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    لا توجد طلبات صيانة
                  </td>
                </tr>
              ) : (
                filtered.map((req) => {
                  const priority = PRIORITY_CONFIG[req.priority]
                  const status   = STATUS_CONFIG[req.status]
                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openUpdate(req)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-xs">
                          {(req.unit as any)?.property?.name ?? '—'}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          وحدة {(req.unit as any)?.unit_number ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {CATEGORY_LABELS[req.category ?? ''] ?? req.category ?? '—'}
                      </td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <div className="font-medium truncate">{req.title}</div>
                        {req.description && (
                          <div className="text-xs text-muted-foreground truncate">{req.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {priority && (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${priority.class}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
                            {priority.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {status && (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs ${status.class}`}>
                            {status.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(req.created_at), 'd MMM yyyy', { locale: ar })}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={(e) => { e.stopPropagation(); openUpdate(req) }}
                        >
                          تحديث
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ─── Kanban View ────────────────────────────────────────────

  function KanbanView() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {KANBAN_COLUMNS.map((col) => {
          const colItems = filtered.filter((r) => r.status === col.status)
          return (
            <div key={col.status} className="rounded-xl border bg-card overflow-hidden">
              <div className={`px-4 py-3 border-b flex items-center justify-between ${col.headerClass}`}>
                <span className="font-semibold text-sm">{col.title}</span>
                <span className="text-xs font-bold bg-white/60 rounded-full px-2 py-0.5">
                  {colItems.length}
                </span>
              </div>
              <div className="p-3 space-y-2 min-h-[200px]">
                {colItems.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">لا توجد طلبات</p>
                ) : (
                  colItems.map((req) => {
                    const priority = PRIORITY_CONFIG[req.priority]
                    return (
                      <div
                        key={req.id}
                        onClick={() => openUpdate(req)}
                        className="rounded-lg border bg-background p-3 space-y-2 cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug flex-1">{req.title}</p>
                          {priority && (
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${priority.class}`}>
                              {priority.label}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(req.unit as any)?.property?.name} — وحدة {(req.unit as any)?.unit_number}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{CATEGORY_LABELS[req.category ?? ''] ?? '—'}</span>
                          <span>{format(new Date(req.created_at), 'd MMM', { locale: ar })}</span>
                        </div>
                        {req.assigned_to && (
                          <div className="text-xs text-muted-foreground border-t pt-1.5 mt-1">
                            الفني: {technicians.find((t) => t.id === req.assigned_to)?.full_name ?? '—'}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filters */}
        <Select value={filterProperty} onValueChange={setFilterProperty}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="كل العقارات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل العقارات</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="كل الأولويات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأولويات</SelectItem>
            <SelectItem value="urgent">عاجلة</SelectItem>
            <SelectItem value="high">عالية</SelectItem>
            <SelectItem value="medium">متوسطة</SelectItem>
            <SelectItem value="low">منخفضة</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="كل الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="open">مفتوح</SelectItem>
            <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex rounded-lg border overflow-hidden">
          <button
            onClick={() => setView('table')}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
              view === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            <List className="h-4 w-4" />
            جدول
          </button>
          <button
            onClick={() => setView('kanban')}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors border-r ${
              view === 'kanban' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            كانبان
          </button>
        </div>

        {/* New request */}
        <Button
          size="sm"
          onClick={() => setRequestDialogOpen(true)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          طلب جديد
        </Button>
      </div>

      {/* Count */}
      {filtered.length !== requests.length && (
        <p className="text-xs text-muted-foreground">
          يعرض {filtered.length} من {requests.length} طلب
        </p>
      )}

      {/* View */}
      {view === 'table' ? <TableView /> : <KanbanView />}

      {/* Dialogs */}
      <MaintenanceRequestDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        onSuccess={() => router.refresh()}
        units={units}
      />

      {selectedRequest && (
        <UpdateStatusDialog
          key={selectedRequest.id}
          open={updateDialogOpen}
          onOpenChange={setUpdateDialogOpen}
          onSuccess={() => router.refresh()}
          request={selectedRequest}
          technicians={technicians}
        />
      )}
    </div>
  )
}
