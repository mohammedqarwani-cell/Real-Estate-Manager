'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CalendarCheck, DollarSign, Building2, Clock } from 'lucide-react'

interface Props {
  totalRooms:       number
  todayCount:       number
  monthlyRevenue:   number
  avgDurationHours: number | null
  revenueByRoom:    { name: string; revenue: number; color: string }[]
}

const COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#F97316', '#EC4899',
]

export function BusinessCenterStats({
  totalRooms,
  todayCount,
  monthlyRevenue,
  avgDurationHours,
  revenueByRoom,
}: Props) {
  const stats = [
    {
      label: 'إجمالي القاعات',
      value: totalRooms,
      icon: Building2,
      color: 'text-blue-600',
      bg:    'bg-blue-50',
    },
    {
      label: 'حجوزات اليوم',
      value: todayCount,
      icon: CalendarCheck,
      color: 'text-emerald-600',
      bg:    'bg-emerald-50',
    },
    {
      label: 'إيرادات الشهر',
      value: `${monthlyRevenue.toLocaleString('ar-AE')} د.إ`,
      icon: DollarSign,
      color: 'text-violet-600',
      bg:    'bg-violet-50',
    },
    {
      label: 'متوسط مدة الحجز',
      value: avgDurationHours !== null ? `${avgDurationHours.toFixed(1)} ساعة` : '—',
      icon: Clock,
      color: 'text-amber-600',
      bg:    'bg-amber-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border bg-card p-5 flex items-center gap-4">
            <div className={`rounded-lg p-3 ${bg} shrink-0`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold mt-0.5 truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue per Room */}
      {revenueByRoom.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">الإيرادات حسب القاعة — هذا الشهر</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenueByRoom} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v.toLocaleString('ar-AE')}`}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toLocaleString('ar-AE')} د.إ`, 'الإيرادات']}
                contentStyle={{ fontSize: 12, direction: 'rtl' }}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {revenueByRoom.map((entry, i) => (
                  <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
