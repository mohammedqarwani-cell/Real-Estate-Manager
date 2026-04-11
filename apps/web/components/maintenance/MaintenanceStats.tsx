'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Wrench, Clock, CheckCircle2, AlertTriangle } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────

interface CategoryStat {
  name:  string
  count: number
  color: string
}

interface MaintenanceStatsProps {
  openCount:           number
  inProgressCount:     number
  completedThisMonth:  number
  avgResolutionDays:   number | null
  categoryStats:       CategoryStat[]
}

// ─── Custom Tooltip ─────────────────────────────────────────

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border rounded-lg shadow-lg px-3 py-2 text-sm" dir="rtl">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-muted-foreground">{payload[0].value} طلب</p>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export function MaintenanceStats({
  openCount,
  inProgressCount,
  completedThisMonth,
  avgResolutionDays,
  categoryStats,
}: MaintenanceStatsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* KPI Cards */}
      <div className="lg:col-span-1 grid grid-cols-2 gap-4">
        {/* Open */}
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">مفتوحة</span>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Wrench className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-600">{openCount}</p>
          <p className="text-xs text-muted-foreground">طلب مفتوح</p>
        </div>

        {/* In Progress */}
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">قيد التنفيذ</span>
            <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{inProgressCount}</p>
          <p className="text-xs text-muted-foreground">طلب جارٍ</p>
        </div>

        {/* Completed This Month */}
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">مكتملة هذا الشهر</span>
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-green-600">{completedThisMonth}</p>
          <p className="text-xs text-muted-foreground">طلب مكتمل</p>
        </div>

        {/* Avg Resolution */}
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">متوسط الحل</span>
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
              <Clock className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-purple-600">
            {avgResolutionDays ?? '—'}
          </p>
          <p className="text-xs text-muted-foreground">
            {avgResolutionDays !== null ? 'يوم في المتوسط' : 'لا توجد بيانات'}
          </p>
        </div>
      </div>

      {/* Pie Chart */}
      <div className="lg:col-span-2 rounded-xl border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">توزيع أنواع المشاكل</h3>
        {categoryStats.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            لا توجد بيانات بعد
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categoryStats}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40}
                paddingAngle={3}
              >
                {categoryStats.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
