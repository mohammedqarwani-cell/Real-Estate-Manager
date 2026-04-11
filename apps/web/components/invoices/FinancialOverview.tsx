'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, AlertCircle, DollarSign, Users } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MonthlyRevenue {
  month: string       // e.g. "يناير 2026"
  month_key: string   // e.g. "2026-01" for sorting
  revenue: number
  count: number
}

export interface TopDebtor {
  tenant_id: string
  tenant_name: string
  overdue_amount: number
  overdue_count: number
}

interface FinancialOverviewProps {
  collectedThisMonth: number
  totalOverdue: number
  overdueCount: number
  monthlyRevenue: MonthlyRevenue[]
  topDebtors: TopDebtor[]
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border rounded-lg shadow-lg px-3 py-2 text-sm" dir="rtl">
      <p className="font-medium text-foreground mb-1">{label}</p>
      <p className="text-primary">
        {payload[0]?.value?.toLocaleString('ar-AE')} د.إ
      </p>
      <p className="text-muted-foreground text-xs">{payload[1]?.value ?? 0} فاتورة</p>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function FinancialOverview({
  collectedThisMonth,
  totalOverdue,
  overdueCount,
  monthlyRevenue,
  topDebtors,
}: FinancialOverviewProps) {
  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={<DollarSign className="h-5 w-5" />}
          title="المحصّل هذا الشهر"
          value={`${collectedThisMonth.toLocaleString('ar-AE')} د.إ`}
          color="green"
        />
        <KPICard
          icon={<AlertCircle className="h-5 w-5" />}
          title="إجمالي المتأخرات"
          value={`${totalOverdue.toLocaleString('ar-AE')} د.إ`}
          sub={`${overdueCount} فاتورة`}
          color="red"
        />
        <KPICard
          icon={<TrendingUp className="h-5 w-5" />}
          title="نسبة التحصيل"
          value={
            collectedThisMonth + totalOverdue > 0
              ? `${Math.round((collectedThisMonth / (collectedThisMonth + totalOverdue)) * 100)}%`
              : '—'
          }
          color="blue"
        />
        <KPICard
          icon={<Users className="h-5 w-5" />}
          title="عدد المتأخرين"
          value={topDebtors.length.toString()}
          sub="مستأجر"
          color="orange"
        />
      </div>

      {/* Chart + Top Debtors */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Bar Chart */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4" dir="rtl">التحصيل — آخر 6 أشهر</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={monthlyRevenue}
              margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="revenue"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Debtors */}
        <div className="rounded-xl border bg-card p-4" dir="rtl">
          <h3 className="text-sm font-semibold mb-3">أكثر المتأخرين</h3>
          {topDebtors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-xs">لا توجد متأخرات</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {topDebtors.slice(0, 6).map((d, i) => (
                <li key={d.tenant_id} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.tenant_name}</p>
                    <p className="text-xs text-muted-foreground">{d.overdue_count} فاتورة</p>
                  </div>
                  <span className="text-sm font-semibold text-red-600 shrink-0">
                    {d.overdue_amount.toLocaleString('ar-AE')}
                    <span className="text-xs font-normal text-muted-foreground mr-0.5">د.إ</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KPICard({
  icon,
  title,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  title: string
  value: string
  sub?: string
  color: 'green' | 'red' | 'blue' | 'orange'
}) {
  const colorMap = {
    green:  'bg-green-50  text-green-600  dark:bg-green-950/30',
    red:    'bg-red-50    text-red-600    dark:bg-red-950/30',
    blue:   'bg-blue-50   text-blue-600   dark:bg-blue-950/30',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/30',
  }
  return (
    <div className="rounded-xl border bg-card p-4" dir="rtl">
      <div className="flex items-center gap-3 mb-3">
        <span className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</span>
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}
