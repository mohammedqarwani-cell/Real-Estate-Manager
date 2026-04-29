'use client'

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, subMonths, startOfMonth, differenceInDays, parseISO, getYear } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import {
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Building2,
  AlertTriangle,
  CalendarCheck,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { exportToExcel } from '@/lib/excel-export'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaidInvoice {
  paid_date: string
  total_amount: number
  type: string
}

interface UnitOccupancy {
  id: string
  status: string
  property: { id: string; name: string } | null
}

interface OverdueInvoice {
  id: string
  invoice_number: string
  total_amount: number
  due_date: string
  tenant: { id: string; full_name: string; phone: string | null } | null
  unit: { id: string; unit_number: string; property: { id: string; name: string } | null } | null
}

interface BookingItem {
  id: string
  start_time: string
  amount: number
  status: string
  meeting_room: { id: string; name: string; property: { id: string; name: string } | null } | null
}

export interface ReportsClientProps {
  paidInvoices: PaidInvoice[]
  units: UnitOccupancy[]
  overdueInvoices: OverdueInvoice[]
  bookings: BookingItem[]
}

type TabId = 'financial' | 'occupancy' | 'overdue' | 'business'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtAmt = (n: number) => `${n.toLocaleString('ar-AE')} د.إ`

/** Capture a chart container as a PNG base64 data URL via SVG → Canvas */
async function captureChartImage(
  ref: React.RefObject<HTMLDivElement | null>
): Promise<string | null> {
  const svgEl = ref.current?.querySelector('svg')
  if (!svgEl) return null
  try {
    const clone = svgEl.cloneNode(true) as SVGElement
    // Inline background
    clone.style.background = '#ffffff'
    const svgData = new XMLSerializer().serializeToString(clone)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    return await new Promise<string | null>((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || svgEl.clientWidth || 600
        canvas.height = img.naturalHeight || svgEl.clientHeight || 300
        const ctx = canvas.getContext('2d')
        if (!ctx) { URL.revokeObjectURL(url); resolve(null); return }
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
      img.src = url
    })
  } catch {
    return null
  }
}

async function downloadReportPDF(
  data: import('@/components/pdf/ReportDocument').ReportDocumentData
) {
  // Import the generate helper (which imports @react-pdf/renderer statically).
  // This pattern avoids the React 19 reconciler conflict that occurs when
  // @react-pdf/renderer is dynamically imported and then used with JSX directly.
  const { generateReportPDF } = await import('@/components/pdf/generate')
  const blob = await generateReportPDF(data)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${data.title}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabButton({
  id,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  id: TabId
  label: string
  icon: React.ElementType
  active: boolean
  onClick: (id: TabId) => void
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

// ─── Export Buttons Row ───────────────────────────────────────────────────────

function ExportButtons({
  onExcelClick,
  onPDFClick,
  pdfLoading,
}: {
  onExcelClick: () => void
  onPDFClick: () => void
  pdfLoading: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onExcelClick} className="gap-2">
        <FileSpreadsheet className="h-4 w-4 text-green-600" />
        تصدير Excel
      </Button>
      <Button variant="outline" size="sm" onClick={onPDFClick} disabled={pdfLoading} className="gap-2">
        {pdfLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4 text-red-500" />
        )}
        {pdfLoading ? 'جاري التحضير...' : 'تصدير PDF'}
      </Button>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReportsClient({
  paidInvoices,
  units,
  overdueInvoices,
  bookings,
}: ReportsClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('financial')
  const [financialPeriod, setFinancialPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [businessPeriod, setBusinessPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [pdfLoading, setPdfLoading] = useState(false)

  const financialChartRef = useRef<HTMLDivElement>(null)

  // ── Realtime: refresh on any change to invoices / units / bookings ────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' },    () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router])
  const occupancyChartRef = useRef<HTMLDivElement>(null)
  const overdueChartRef   = useRef<HTMLDivElement>(null)
  const businessChartRef  = useRef<HTMLDivElement>(null)

  // ── Financial Data ────────────────────────────────────────────────────────

  const financialMonthly = useMemo((): Array<{ period: string; revenue: number; count: number }> => {
    const now = new Date()
    const buckets = new Map<string, { period: string; revenue: number; count: number }>()
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i)
      const key = format(d, 'yyyy-MM')
      buckets.set(key, { period: format(d, 'MMM yy', { locale: ar }), revenue: 0, count: 0 })
    }
    for (const inv of paidInvoices) {
      const key = inv.paid_date.slice(0, 7)
      if (buckets.has(key)) {
        const b = buckets.get(key)!
        b.revenue += inv.total_amount
        b.count += 1
      }
    }
    return Array.from(buckets.values())
  }, [paidInvoices])

  const financialYearly = useMemo((): Array<{ period: string; revenue: number; count: number }> => {
    const buckets = new Map<string, { period: string; revenue: number; count: number }>()
    const currentYear = getYear(new Date())
    for (let y = currentYear - 4; y <= currentYear; y++) {
      buckets.set(String(y), { period: String(y), revenue: 0, count: 0 })
    }
    for (const inv of paidInvoices) {
      const y = inv.paid_date.slice(0, 4)
      if (buckets.has(y)) {
        const b = buckets.get(y)!
        b.revenue += inv.total_amount
        b.count += 1
      }
    }
    return Array.from(buckets.values())
  }, [paidInvoices])

  const financialData = financialPeriod === 'monthly' ? financialMonthly : financialYearly
  const financialXKey = 'period'
  const financialTotal = financialData.reduce((s, r) => s + r.revenue, 0)
  const financialCount = financialData.reduce((s, r) => s + r.count, 0)

  // ── Occupancy Data ────────────────────────────────────────────────────────

  const occupancyData = useMemo(() => {
    const map = new Map<string, { property: string; occupied: number; available: number; other: number }>()
    for (const u of units) {
      const name = u.property?.name ?? 'غير محدد'
      if (!map.has(name)) map.set(name, { property: name, occupied: 0, available: 0, other: 0 })
      const b = map.get(name)!
      if (u.status === 'occupied') b.occupied++
      else if (u.status === 'available') b.available++
      else b.other++
    }
    return Array.from(map.values())
  }, [units])

  const totalUnits    = units.length
  const occupiedUnits = units.filter((u) => u.status === 'occupied').length
  const availableUnits = units.filter((u) => u.status === 'available').length
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0

  // ── Overdue Data ──────────────────────────────────────────────────────────

  const overdueChartData = useMemo(() => {
    const tenantMap = new Map<string, { tenant: string; amount: number }>()
    for (const inv of overdueInvoices) {
      const name = inv.tenant?.full_name ?? 'غير محدد'
      if (!tenantMap.has(name)) tenantMap.set(name, { tenant: name, amount: 0 })
      tenantMap.get(name)!.amount += inv.total_amount
    }
    return Array.from(tenantMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
  }, [overdueInvoices])

  const totalOverdue = overdueInvoices.reduce((s, i) => s + i.total_amount, 0)

  // ── Business Center Data ──────────────────────────────────────────────────

  const businessMonthly = useMemo((): Array<{ period: string; revenue: number; count: number }> => {
    const now = new Date()
    const buckets = new Map<string, { period: string; revenue: number; count: number }>()
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i)
      const key = format(d, 'yyyy-MM')
      buckets.set(key, { period: format(d, 'MMM yy', { locale: ar }), revenue: 0, count: 0 })
    }
    for (const b of bookings) {
      const key = b.start_time.slice(0, 7)
      if (buckets.has(key)) {
        const bkt = buckets.get(key)!
        bkt.revenue += b.amount
        bkt.count++
      }
    }
    return Array.from(buckets.values())
  }, [bookings])

  const businessYearly = useMemo((): Array<{ period: string; revenue: number; count: number }> => {
    const buckets = new Map<string, { period: string; revenue: number; count: number }>()
    const currentYear = getYear(new Date())
    for (let y = currentYear - 4; y <= currentYear; y++) {
      buckets.set(String(y), { period: String(y), revenue: 0, count: 0 })
    }
    for (const b of bookings) {
      const y = b.start_time.slice(0, 4)
      if (buckets.has(y)) {
        const bkt = buckets.get(y)!
        bkt.revenue += b.amount
        bkt.count++
      }
    }
    return Array.from(buckets.values())
  }, [bookings])

  const businessData = businessPeriod === 'monthly' ? businessMonthly : businessYearly
  const businessXKey = 'period'
  const businessTotal = businessData.reduce((s, r) => s + r.revenue, 0)

  // ── PDF Export Handlers ───────────────────────────────────────────────────

  const handleFinancialPDF = useCallback(async () => {
    setPdfLoading(true)
    try {
      const chartImage = await captureChartImage(financialChartRef)
      const rows = financialData.map((r) => [
        r.period,
        fmtAmt(r.revenue),
        String(r.count),
      ])
      await downloadReportPDF({
        title: 'التقرير المالي',
        subtitle: financialPeriod === 'monthly' ? 'الإيرادات الشهرية (آخر 12 شهراً)' : 'الإيرادات السنوية (آخر 5 سنوات)',
        period: '',
        generatedAt: format(new Date(), 'dd/MM/yyyy HH:mm'),
        summaryStats: [
          { label: 'إجمالي الإيرادات', value: fmtAmt(financialTotal), highlight: true },
          { label: 'عدد الفواتير المدفوعة', value: String(financialCount) },
          { label: 'متوسط الفاتورة', value: financialCount > 0 ? fmtAmt(Math.round(financialTotal / financialCount)) : '—' },
        ],
        chartImage,
        tableHeaders: [financialPeriod === 'monthly' ? 'الشهر' : 'السنة', 'الإيرادات', 'عدد الفواتير'],
        tableRows: rows,
        colWidths: [2, 2, 1],
      })
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء توليد PDF')
    } finally {
      setPdfLoading(false)
    }
  }, [financialData, financialPeriod, financialTotal, financialCount])

  const handleOccupancyPDF = useCallback(async () => {
    setPdfLoading(true)
    try {
      const chartImage = await captureChartImage(occupancyChartRef)
      const rows = occupancyData.map((r) => {
        const total = r.occupied + r.available + r.other
        const rate = total > 0 ? `${Math.round((r.occupied / total) * 100)}٪` : '—'
        return [r.property, String(total), String(r.occupied), String(r.available), rate]
      })
      await downloadReportPDF({
        title: 'تقرير الإشغال',
        subtitle: 'نسبة إشغال الوحدات حسب العقار',
        period: '',
        generatedAt: format(new Date(), 'dd/MM/yyyy HH:mm'),
        summaryStats: [
          { label: 'إجمالي الوحدات', value: String(totalUnits) },
          { label: 'وحدات مؤجرة', value: String(occupiedUnits), highlight: true },
          { label: 'وحدات متاحة', value: String(availableUnits) },
          { label: 'نسبة الإشغال', value: `${occupancyRate}٪`, highlight: true },
        ],
        chartImage,
        tableHeaders: ['العقار', 'الإجمالي', 'مؤجر', 'متاح', 'نسبة الإشغال'],
        tableRows: rows,
        colWidths: [3, 1, 1, 1, 1],
      })
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء توليد PDF')
    } finally {
      setPdfLoading(false)
    }
  }, [occupancyData, totalUnits, occupiedUnits, availableUnits, occupancyRate])

  const handleOverduePDF = useCallback(async () => {
    setPdfLoading(true)
    try {
      const rows = overdueInvoices.map((inv) => {
        const days = differenceInDays(new Date(), parseISO(inv.due_date))
        return [
          inv.tenant?.full_name ?? '—',
          inv.invoice_number,
          inv.unit ? `${(inv.unit as any).property?.name ?? '—'} - وحدة ${inv.unit.unit_number}` : '—',
          fmtAmt(inv.total_amount),
          `${days} يوم`,
        ]
      })
      await downloadReportPDF({
        title: 'تقرير المتأخرات',
        subtitle: 'الفواتير المتأخرة وتفاصيل المدينين',
        period: '',
        generatedAt: format(new Date(), 'dd/MM/yyyy HH:mm'),
        summaryStats: [
          { label: 'إجمالي المتأخرات', value: fmtAmt(totalOverdue), highlight: true },
          { label: 'عدد الفواتير المتأخرة', value: String(overdueInvoices.length) },
          { label: 'عدد المدينين', value: String(new Set(overdueInvoices.map((i) => i.tenant?.id)).size) },
        ],
        chartImage: null,
        tableHeaders: ['المستأجر', 'رقم الفاتورة', 'العقار / الوحدة', 'المبلغ', 'أيام التأخر'],
        tableRows: rows,
        colWidths: [2, 2, 3, 2, 1],
      })
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء توليد PDF')
    } finally {
      setPdfLoading(false)
    }
  }, [overdueInvoices, totalOverdue])

  const handleBusinessPDF = useCallback(async () => {
    setPdfLoading(true)
    try {
      const chartImage = await captureChartImage(businessChartRef)
      const rows = businessData.map((r) => [
        r.period,
        fmtAmt(r.revenue),
        String(r.count),
      ])
      await downloadReportPDF({
        title: 'إيرادات قاعات الاجتماع',
        subtitle: businessPeriod === 'monthly' ? 'إيرادات قاعات الاجتماعات شهرياً' : 'إيرادات قاعات الاجتماعات سنوياً',
        period: '',
        generatedAt: format(new Date(), 'dd/MM/yyyy HH:mm'),
        summaryStats: [
          { label: 'إجمالي الإيرادات', value: fmtAmt(businessTotal), highlight: true },
          { label: 'عدد الحجوزات', value: String(bookings.length) },
        ],
        chartImage,
        tableHeaders: [businessPeriod === 'monthly' ? 'الشهر' : 'السنة', 'الإيرادات', 'عدد الحجوزات'],
        tableRows: rows,
        colWidths: [2, 2, 1],
      })
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء توليد PDF')
    } finally {
      setPdfLoading(false)
    }
  }, [businessData, businessPeriod, businessTotal, bookings])

  // ── Excel Export Handlers ─────────────────────────────────────────────────

  const handleFinancialExcel = () => {
    const rows = financialData.map((r) => ({
      [financialPeriod === 'monthly' ? 'الشهر' : 'السنة']: r.period,
      'الإيرادات (د.إ)': r.revenue,
      'عدد الفواتير': r.count,
    }))
    exportToExcel(rows, `التقرير-المالي-${financialPeriod}`)
  }

  const handleOccupancyExcel = () => {
    const rows = occupancyData.map((r) => {
      const total = r.occupied + r.available + r.other
      return {
        'العقار': r.property,
        'إجمالي الوحدات': total,
        'وحدات مؤجرة': r.occupied,
        'وحدات متاحة': r.available,
        'أخرى': r.other,
        'نسبة الإشغال ٪': total > 0 ? Math.round((r.occupied / total) * 100) : 0,
      }
    })
    exportToExcel(rows, 'تقرير-الإشغال')
  }

  const handleOverdueExcel = () => {
    const rows = overdueInvoices.map((inv) => ({
      'المستأجر': inv.tenant?.full_name ?? '—',
      'رقم الفاتورة': inv.invoice_number,
      'العقار': (inv.unit as any)?.property?.name ?? '—',
      'الوحدة': inv.unit?.unit_number ?? '—',
      'المبلغ (د.إ)': inv.total_amount,
      'تاريخ الاستحقاق': inv.due_date,
      'أيام التأخر': differenceInDays(new Date(), parseISO(inv.due_date)),
    }))
    exportToExcel(rows, 'تقرير-المتأخرات')
  }

  const handleBusinessExcel = () => {
    const rows = businessData.map((r) => ({
      [businessPeriod === 'monthly' ? 'الشهر' : 'السنة']: r.period,
      'الإيرادات (د.إ)': r.revenue,
      'عدد الحجوزات': r.count,
    }))
    exportToExcel(rows, `إيرادات-البزنس-سنتر-${businessPeriod}`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'financial',  label: 'التقرير المالي',      icon: TrendingUp },
    { id: 'occupancy',  label: 'تقرير الإشغال',       icon: Building2 },
    { id: 'overdue',    label: 'تقرير المتأخرات',     icon: AlertTriangle },
    { id: 'business',   label: 'إيرادات قاعات الاجتماع', icon: CalendarCheck },
  ]

  return (
    <div className="space-y-6">
      {/* Tab Buttons */}
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {TABS.map((tab) => (
          <TabButton
            key={tab.id}
            id={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={activeTab === tab.id}
            onClick={setActiveTab}
          />
        ))}
      </div>

      {/* ── Financial Report ───────────────────────────────────────────────── */}
      {activeTab === 'financial' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">التقرير المالي</h2>
              <Select
                value={financialPeriod}
                onValueChange={(v) => setFinancialPeriod(v as 'monthly' | 'yearly')}
              >
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">شهري — آخر 12 شهر</SelectItem>
                  <SelectItem value="yearly">سنوي — آخر 5 سنوات</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ExportButtons
              onExcelClick={handleFinancialExcel}
              onPDFClick={handleFinancialPDF}
              pdfLoading={pdfLoading}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="إجمالي الإيرادات" value={fmtAmt(financialTotal)} />
            <StatCard label="عدد الفواتير المدفوعة" value={String(financialCount)} />
            <StatCard
              label="متوسط قيمة الفاتورة"
              value={financialCount > 0 ? fmtAmt(Math.round(financialTotal / financialCount)) : '—'}
            />
          </div>

          {/* Chart */}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground mb-4">
              {financialPeriod === 'monthly' ? 'الإيرادات الشهرية (آخر 12 شهراً)' : 'الإيرادات السنوية (آخر 5 سنوات)'}
            </p>
            <div ref={financialChartRef}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={financialData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey={financialXKey} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [fmtAmt(value), 'الإيرادات']}
                    labelStyle={{ fontFamily: 'inherit', direction: 'rtl' }}
                  />
                  <Bar dataKey="revenue" name="الإيرادات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                    {financialPeriod === 'monthly' ? 'الشهر' : 'السنة'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الإيرادات</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">عدد الفواتير</th>
                </tr>
              </thead>
              <tbody>
                {financialData.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {row.period}
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary">{fmtAmt(row.revenue)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Occupancy Report ───────────────────────────────────────────────── */}
      {activeTab === 'occupancy' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">تقرير الإشغال</h2>
            <ExportButtons
              onExcelClick={handleOccupancyExcel}
              onPDFClick={handleOccupancyPDF}
              pdfLoading={pdfLoading}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="إجمالي الوحدات" value={String(totalUnits)} />
            <StatCard label="وحدات مؤجرة" value={String(occupiedUnits)} />
            <StatCard label="وحدات متاحة" value={String(availableUnits)} />
            <StatCard label="نسبة الإشغال" value={`${occupancyRate}٪`} />
          </div>

          {/* Chart */}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground mb-4">توزيع الوحدات حسب الحالة والعقار</p>
            <div ref={occupancyChartRef}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={occupancyData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="property" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelStyle={{ fontFamily: 'inherit', direction: 'rtl' }}
                  />
                  <Legend />
                  <Bar dataKey="occupied" name="مؤجرة" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="available" name="متاحة" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="other" name="أخرى" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">العقار</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الإجمالي</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">مؤجرة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">متاحة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">نسبة الإشغال</th>
                </tr>
              </thead>
              <tbody>
                {occupancyData.map((row, i) => {
                  const total = row.occupied + row.available + row.other
                  const rate = total > 0 ? Math.round((row.occupied / total) * 100) : 0
                  return (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{row.property}</td>
                      <td className="px-4 py-3 text-muted-foreground">{total}</td>
                      <td className="px-4 py-3">
                        <span className="text-green-700 font-semibold">{row.occupied}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-blue-700 font-semibold">{row.available}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[80px]">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{rate}٪</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Overdue Report ─────────────────────────────────────────────────── */}
      {activeTab === 'overdue' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">تقرير المتأخرات</h2>
            <ExportButtons
              onExcelClick={handleOverdueExcel}
              onPDFClick={handleOverduePDF}
              pdfLoading={pdfLoading}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="إجمالي المتأخرات" value={fmtAmt(totalOverdue)} />
            <StatCard label="عدد الفواتير المتأخرة" value={String(overdueInvoices.length)} />
            <StatCard
              label="عدد المدينين"
              value={String(new Set(overdueInvoices.map((i) => i.tenant?.id)).size)}
            />
          </div>

          {/* Chart: top 10 tenants */}
          {overdueChartData.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground mb-4">أكبر المتأخرين (حسب المبلغ)</p>
              <div ref={overdueChartRef}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={overdueChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 60, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="tenant" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip
                      formatter={(value: number) => [fmtAmt(value), 'المبلغ المتأخر']}
                    />
                    <Bar dataKey="amount" name="المبلغ" fill="#ef4444" radius={[0, 4, 4, 0]}>
                      {overdueChartData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={index === 0 ? '#b91c1c' : index < 3 ? '#ef4444' : '#fca5a5'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            {overdueInvoices.length === 0 ? (
              <div className="py-12 text-center">
                <AlertTriangle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">لا توجد فواتير متأخرة</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المستأجر</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">رقم الفاتورة</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">العقار / الوحدة</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المبلغ</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">تاريخ الاستحقاق</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">أيام التأخر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueInvoices.map((inv) => {
                      const days = differenceInDays(new Date(), parseISO(inv.due_date))
                      return (
                        <tr
                          key={inv.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">
                            {inv.tenant?.full_name ?? '—'}
                            {inv.tenant?.phone && (
                              <div className="text-xs text-muted-foreground">{inv.tenant.phone}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {inv.invoice_number}
                          </td>
                          <td className="px-4 py-3">
                            {inv.unit ? (
                              <>
                                <div>{(inv.unit as any).property?.name ?? '—'}</div>
                                <div className="text-xs text-muted-foreground">
                                  وحدة {inv.unit.unit_number}
                                </div>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-red-600">
                            {fmtAmt(inv.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {format(parseISO(inv.due_date), 'dd MMM yyyy', { locale: ar })}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                days > 60
                                  ? 'bg-red-100 text-red-700'
                                  : days > 30
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {days} يوم
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
        </div>
      )}

      {/* ── Business Center Revenue ────────────────────────────────────────── */}
      {activeTab === 'business' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">إيرادات قاعات الاجتماع</h2>
              <Select
                value={businessPeriod}
                onValueChange={(v) => setBusinessPeriod(v as 'monthly' | 'yearly')}
              >
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">شهري — آخر 12 شهر</SelectItem>
                  <SelectItem value="yearly">سنوي — آخر 5 سنوات</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ExportButtons
              onExcelClick={handleBusinessExcel}
              onPDFClick={handleBusinessPDF}
              pdfLoading={pdfLoading}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="إجمالي الإيرادات" value={fmtAmt(businessTotal)} />
            <StatCard label="إجمالي الحجوزات" value={String(bookings.length)} />
          </div>

          {/* Chart */}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground mb-4">
              {businessPeriod === 'monthly'
                ? 'إيرادات قاعات الاجتماعات شهرياً (آخر 12 شهراً)'
                : 'إيرادات قاعات الاجتماعات سنوياً (آخر 5 سنوات)'}
            </p>
            <div ref={businessChartRef}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={businessData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey={businessXKey} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [fmtAmt(value), 'الإيرادات']}
                    labelStyle={{ fontFamily: 'inherit', direction: 'rtl' }}
                  />
                  <Bar dataKey="revenue" name="الإيرادات" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                    {businessPeriod === 'monthly' ? 'الشهر' : 'السنة'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الإيرادات</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">عدد الحجوزات</th>
                </tr>
              </thead>
              <tbody>
                {businessData.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {row.period}
                    </td>
                    <td className="px-4 py-3 font-semibold text-purple-700">{fmtAmt(row.revenue)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
