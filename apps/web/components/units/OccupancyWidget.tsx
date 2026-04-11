'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Unit } from '@repo/types'

// ─── Config ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  available: { label: 'متاح', color: '#22c55e' },
  occupied: { label: 'مؤجر', color: '#ef4444' },
  maintenance: { label: 'صيانة', color: '#f97316' },
  reserved: { label: 'محجوز', color: '#eab308' },
} as const

// ─── Custom Tooltip ────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { name: string; value: number; payload: { color: string } }[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-popover border rounded-lg shadow-md px-3 py-2 text-sm" dir="rtl">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ background: item.payload.color }}
        />
        <span className="font-medium">{item.name}</span>
        <span className="text-muted-foreground mr-1">{item.value} وحدة</span>
      </div>
    </div>
  )
}

// ─── Custom Legend ──────────────────────────────────────────────────────────

function CustomLegend({
  payload,
}: {
  payload?: { value: string; color: string; payload: { count: number; percent: number } }[]
}) {
  if (!payload) return null
  return (
    <ul className="flex flex-col gap-1.5 text-sm" dir="rtl">
      {payload.map((entry, i) => (
        <li key={i} className="flex items-center justify-between gap-4 min-w-[110px]">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: entry.color }}
            />
            <span>{entry.value}</span>
          </div>
          <span className="text-muted-foreground text-xs">
            {entry.payload.count} ({entry.payload.percent}%)
          </span>
        </li>
      ))}
    </ul>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

interface OccupancyWidgetProps {
  units: Unit[]
}

export function OccupancyWidget({ units }: OccupancyWidgetProps) {
  if (units.length === 0) return null

  // Build chart data
  const counts = {
    available: units.filter((u) => u.status === 'available').length,
    occupied: units.filter((u) => u.status === 'occupied').length,
    maintenance: units.filter((u) => u.status === 'maintenance').length,
    reserved: units.filter((u) => u.status === 'reserved').length,
  }

  const chartData = (Object.keys(STATUS_CONFIG) as (keyof typeof STATUS_CONFIG)[])
    .filter((key) => counts[key] > 0)
    .map((key) => ({
      name: STATUS_CONFIG[key].label,
      value: counts[key],
      color: STATUS_CONFIG[key].color,
      count: counts[key],
      percent: Math.round((counts[key] / units.length) * 100),
    }))

  // Monthly revenue: sum of occupied units' monthly_rent
  const monthlyRevenue = units
    .filter((u) => u.status === 'occupied' && u.monthly_rent != null)
    .reduce((sum, u) => sum + (u.monthly_rent ?? 0), 0)

  const occupancyRate = Math.round((counts.occupied / units.length) * 100)

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold text-base mb-4" dir="rtl">
        نظرة عامة على الإشغال
      </h2>

      <div className="flex flex-col sm:flex-row items-center gap-6" dir="rtl">
        {/* Donut Chart */}
        <div className="w-full sm:w-48 h-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {/* Center text rendered via foreignObject isn't reliable — use overlay */}
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-4 w-full">
          {/* Legend */}
          <CustomLegend
            payload={chartData.map((d) => ({
              value: d.name,
              color: d.color,
              payload: { count: d.count, percent: d.percent },
            }))}
          />

          {/* Divider */}
          <div className="border-t" />

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">نسبة الإشغال</p>
              <p className="text-2xl font-bold">
                {occupancyRate}
                <span className="text-sm font-normal text-muted-foreground">%</span>
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">إيرادات هذا الشهر</p>
              <p className="text-2xl font-bold">
                {monthlyRevenue.toLocaleString('ar-AE')}
                <span className="text-sm font-normal text-muted-foreground"> د.إ</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
