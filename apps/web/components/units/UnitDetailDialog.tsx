'use client'

import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  Home,
  User,
  Phone,
  Mail,
  FileText,
  Wrench,
  Pencil,
  CalendarDays,
  AreaChart,
  Layers,
  Banknote,
  Tag,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Unit, Contract, MaintenanceRequest, Tenant, UnitStatus, ContractStatus, MaintenanceStatus } from '@repo/types'

// ─── Constants ─────────────────────────────────────────────────────────────

const UNIT_TYPE_LABELS: Record<string, string> = {
  apartment: 'شقة',
  office: 'مكتب',
  retail: 'محل تجاري',
  studio: 'استوديو',
  villa: 'فيلا',
  warehouse: 'مستودع',
}

const STATUS_CONFIG: Record<UnitStatus, { label: string; className: string }> = {
  available: { label: 'متاح', className: 'bg-green-100 text-green-700' },
  occupied: { label: 'مؤجر', className: 'bg-red-100 text-red-700' },
  maintenance: { label: 'صيانة', className: 'bg-orange-100 text-orange-700' },
  reserved: { label: 'محجوز', className: 'bg-yellow-100 text-yellow-700' },
}

const CONTRACT_STATUS_CONFIG: Record<ContractStatus, { label: string; className: string }> = {
  active: { label: 'نشط', className: 'bg-green-100 text-green-700' },
  draft: { label: 'مسودة', className: 'bg-gray-100 text-gray-600' },
  expired: { label: 'منتهي', className: 'bg-red-100 text-red-700' },
  terminated: { label: 'مُنهى', className: 'bg-red-100 text-red-700' },
  renewed: { label: 'مُجدَّد', className: 'bg-blue-100 text-blue-700' },
}

const MAINTENANCE_STATUS_CONFIG: Record<MaintenanceStatus, { label: string; className: string }> = {
  open: { label: 'مفتوح', className: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'جارٍ', className: 'bg-amber-100 text-amber-700' },
  completed: { label: 'مكتمل', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغي', className: 'bg-gray-100 text-gray-600' },
}

// ─── Helper Components ─────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b last:border-0">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-right">{value}</span>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4 first:mt-0">
      {children}
    </h3>
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────

type ContractWithTenant = Contract & {
  tenant: Pick<Tenant, 'id' | 'full_name' | 'email' | 'phone'> | null
}

interface UnitDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unit: Unit
  activeContract: ContractWithTenant | null
  contracts: ContractWithTenant[]
  maintenanceRequests: MaintenanceRequest[]
  onEdit: () => void
}

// ─── Main Component ────────────────────────────────────────────────────────

export function UnitDetailDialog({
  open,
  onOpenChange,
  unit,
  activeContract,
  contracts,
  maintenanceRequests,
  onEdit,
}: UnitDetailDialogProps) {
  const statusCfg = STATUS_CONFIG[unit.status]
  const pastContracts = contracts.filter((c) => c.status !== 'active' && c.id !== activeContract?.id)
  const openMaintenance = maintenanceRequests.filter(
    (m) => m.status === 'open' || m.status === 'in_progress'
  )
  const closedMaintenance = maintenanceRequests.filter(
    (m) => m.status === 'completed' || m.status === 'cancelled'
  )

  function fmt(date: string) {
    return format(new Date(date), 'd MMM yyyy', { locale: ar })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-muted-foreground" />
                وحدة {unit.unit_number}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusCfg?.className ?? ''}`}
              >
                {statusCfg?.label ?? unit.status}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
                تعديل
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-1 mt-2">
          {/* ─── Basic Info ──────────────────────────────────────────── */}
          <SectionTitle>المعلومات الأساسية</SectionTitle>
          <div className="rounded-lg border px-3">
            {unit.type && (
              <InfoRow
                icon={<Tag className="h-4 w-4" />}
                label="النوع"
                value={UNIT_TYPE_LABELS[unit.type] ?? unit.type}
              />
            )}
            {unit.floor != null && (
              <InfoRow
                icon={<Layers className="h-4 w-4" />}
                label="الطابق"
                value={unit.floor}
              />
            )}
            {unit.area != null && (
              <InfoRow
                icon={<AreaChart className="h-4 w-4" />}
                label="المساحة"
                value={`${unit.area.toLocaleString('ar-AE')} م²`}
              />
            )}
            {unit.monthly_rent != null && (
              <InfoRow
                icon={<Banknote className="h-4 w-4" />}
                label="الإيجار الشهري"
                value={`${unit.monthly_rent.toLocaleString('ar-AE')} د.إ`}
              />
            )}
            {!unit.type && unit.floor == null && unit.area == null && unit.monthly_rent == null && (
              <p className="text-sm text-muted-foreground py-3 text-center">لا توجد معلومات إضافية</p>
            )}
          </div>

          {/* ─── Images ──────────────────────────────────────────────── */}
          {unit.images?.length > 0 && (
            <>
              <SectionTitle>الصور</SectionTitle>
              <div className="flex gap-2 flex-wrap">
                {unit.images.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={src}
                    alt={`صورة ${i + 1}`}
                    className="h-20 w-20 rounded-md object-cover border"
                  />
                ))}
              </div>
            </>
          )}

          {/* ─── Current Tenant ───────────────────────────────────────── */}
          <SectionTitle>المستأجر الحالي</SectionTitle>
          {activeContract?.tenant ? (
            <div className="rounded-lg border px-3">
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="الاسم"
                value={activeContract.tenant.full_name}
              />
              {activeContract.tenant.phone && (
                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  label="الهاتف"
                  value={
                    <a
                      href={`tel:${activeContract.tenant.phone}`}
                      className="text-blue-600 hover:underline"
                    >
                      {activeContract.tenant.phone}
                    </a>
                  }
                />
              )}
              {activeContract.tenant.email && (
                <InfoRow
                  icon={<Mail className="h-4 w-4" />}
                  label="البريد"
                  value={
                    <a
                      href={`mailto:${activeContract.tenant.email}`}
                      className="text-blue-600 hover:underline truncate max-w-[180px]"
                    >
                      {activeContract.tenant.email}
                    </a>
                  }
                />
              )}
              <InfoRow
                icon={<CalendarDays className="h-4 w-4" />}
                label="العقد"
                value={`${fmt(activeContract.start_date)} — ${fmt(activeContract.end_date)}`}
              />
              <InfoRow
                icon={<Banknote className="h-4 w-4" />}
                label="الإيجار المتفق"
                value={`${activeContract.monthly_rent.toLocaleString('ar-AE')} د.إ`}
              />
            </div>
          ) : (
            <div className="rounded-lg border px-4 py-3 text-center text-sm text-muted-foreground">
              لا يوجد مستأجر حالي
            </div>
          )}

          {/* ─── Contract History ─────────────────────────────────────── */}
          {pastContracts.length > 0 && (
            <>
              <SectionTitle>تاريخ العقود ({pastContracts.length})</SectionTitle>
              <div className="space-y-2">
                {pastContracts.map((c) => {
                  const cfg = CONTRACT_STATUS_CONFIG[c.status]
                  return (
                    <div key={c.id} className="rounded-lg border p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {c.tenant?.full_name ?? 'مستأجر غير معروف'}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg?.className ?? ''}`}
                        >
                          {cfg?.label ?? c.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fmt(c.start_date)} — {fmt(c.end_date)}
                        {' · '}
                        {c.monthly_rent.toLocaleString('ar-AE')} د.إ/شهر
                      </p>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ─── Maintenance Requests ────────────────────────────────── */}
          <SectionTitle>
            طلبات الصيانة
            {maintenanceRequests.length > 0 && (
              <span className="mr-1 text-foreground">({maintenanceRequests.length})</span>
            )}
          </SectionTitle>

          {maintenanceRequests.length === 0 ? (
            <div className="rounded-lg border px-4 py-3 text-center text-sm text-muted-foreground">
              لا توجد طلبات صيانة
            </div>
          ) : (
            <div className="space-y-2">
              {[...openMaintenance, ...closedMaintenance].map((m) => {
                const cfg = MAINTENANCE_STATUS_CONFIG[m.status]
                return (
                  <div key={m.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{m.title}</span>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg?.className ?? ''}`}
                      >
                        {cfg?.label ?? m.status}
                      </span>
                    </div>
                    {m.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {fmt(m.created_at)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Notes */}
          {unit.notes && (
            <>
              <SectionTitle>ملاحظات</SectionTitle>
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">
                {unit.notes}
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
