'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, isSameDay } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  Plus, Clock, Users, CalendarX, Building2, Pencil, Trash2,
} from 'lucide-react'
import { toast }                from 'sonner'
import { Button }               from '@/components/ui/button'
import { BusinessCenterStats }  from './BusinessCenterStats'
import { BookingCalendar }      from './BookingCalendar'
import { BookingFormDialog }    from './BookingFormDialog'
import { CancelBookingDialog }  from './CancelBookingDialog'
import { RoomFormDialog }       from './RoomFormDialog'
import { deleteMeetingRoom }    from '@/app/(dashboard)/dashboard/business-center/actions'

// ─── Room Colors (consistent with calendar) ──────────────────────

const ROOM_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B',
  '#EF4444', '#06B6D4', '#F97316', '#EC4899',
]

// ─── Types ───────────────────────────────────────────────────────

interface Room {
  id:            string
  name:          string
  capacity:      number | null
  hourly_rate:   number | null
  half_day_rate: number | null
  full_day_rate: number | null
  amenities:     string[]
  images:        string[]
  description:   string | null
  status:        string
  property?:     { id: string; name: string } | null
}

interface Booking {
  id:              string
  meeting_room_id: string
  start_time:      string
  end_time:        string
  booking_type:    string
  amount:          number | null
  status:          string
  services:        string[]
  visitor_name:    string | null
  notes:           string | null
  cancellation_reason: string | null
  meeting_room?:   { id: string; name: string } | null
  tenant?:         { id: string; full_name: string } | null
}

interface Tenant {
  id:           string
  full_name:    string
  company_name: string | null
}

interface Property {
  id:   string
  name: string
}

interface Props {
  rooms:           Room[]
  bookings:        Booking[]
  tenants:         Tenant[]
  todayBookings:   Booking[]
  monthlyRevenue:  number
  availableNow:    number
  properties:      Property[]
}

// ─── Status config ────────────────────────────────────────────────

const statusConfig = {
  confirmed: { label: 'مؤكد',   cls: 'bg-green-100 text-green-700'  },
  pending:   { label: 'معلق',   cls: 'bg-yellow-100 text-yellow-700' },
  cancelled: { label: 'ملغي',   cls: 'bg-red-100 text-red-700'      },
  completed: { label: 'منتهي',  cls: 'bg-gray-100 text-gray-600'    },
}

// ─── Component ───────────────────────────────────────────────────

export function BusinessCenterClient({
  rooms,
  bookings,
  tenants,
  todayBookings,
  monthlyRevenue,
  availableNow,
  properties,
}: Props) {
  const router = useRouter()

  const [tab, setTab] = useState<'rooms' | 'calendar' | 'today' | 'revenue'>('rooms')
  const [bookingOpen,     setBookingOpen]     = useState(false)
  const [cancelOpen,      setCancelOpen]      = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [defaultDate,     setDefaultDate]     = useState<string | undefined>()
  const [defaultHour,     setDefaultHour]     = useState<number | undefined>()

  // Room management
  const [roomDialogOpen, setRoomDialogOpen] = useState(false)
  const [selectedRoom,   setSelectedRoom]   = useState<Room | null>(null)

  function openAddRoom() { setSelectedRoom(null); setRoomDialogOpen(true) }
  function openEditRoom(r: Room) { setSelectedRoom(r); setRoomDialogOpen(true) }

  async function handleDeleteRoom(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذه القاعة؟')) return
    const result = await deleteMeetingRoom(id)
    if (result.success) { toast.success('تم حذف القاعة'); router.refresh() }
    else toast.error(result.error ?? 'حدث خطأ')
  }

  // Room color index map
  const roomColorMap = useMemo(() => {
    const m = new Map<string, string>()
    rooms.forEach((r, i) => m.set(r.id, ROOM_COLORS[i % ROOM_COLORS.length]))
    return m
  }, [rooms])

  // Stats
  const avgDuration = useMemo(() => {
    const active = bookings.filter((b) => b.status !== 'cancelled')
    if (!active.length) return null
    const totalH = active.reduce((sum, b) => {
      const diff = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3_600_000
      return sum + diff
    }, 0)
    return totalH / active.length
  }, [bookings])

  const revenueByRoom = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number }>()
    bookings
      .filter((b) => b.status !== 'cancelled' && b.amount)
      .forEach((b) => {
        const name = b.meeting_room?.name ?? '—'
        const cur = map.get(b.meeting_room_id) ?? { name, revenue: 0 }
        map.set(b.meeting_room_id, { ...cur, revenue: cur.revenue + (b.amount ?? 0) })
      })
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((item, i) => ({ ...item, color: ROOM_COLORS[i % ROOM_COLORS.length] }))
  }, [bookings])

  function handleSlotClick(date: Date, hour: number) {
    setDefaultDate(format(date, 'yyyy-MM-dd'))
    setDefaultHour(hour)
    setBookingOpen(true)
  }

  function handleBookingClick(booking: Booking) {
    if (booking.status === 'confirmed') {
      setSelectedBooking(booking)
      setCancelOpen(true)
    }
  }

  function openNewBooking() {
    setDefaultDate(undefined)
    setDefaultHour(undefined)
    setBookingOpen(true)
  }

  const TABS = [
    { key: 'rooms',    label: 'القاعات' },
    { key: 'calendar', label: 'التقويم' },
    { key: 'today',    label: `حجوزات اليوم (${todayBookings.length})` },
    { key: 'revenue',  label: 'تقرير الإيرادات' },
  ] as const

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 rounded-lg border p-0.5">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                tab === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openAddRoom} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            إضافة قاعة
          </Button>
          <Button onClick={openNewBooking} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            حجز جديد
          </Button>
        </div>
      </div>

      {/* ── Tab: القاعات ── */}
      {tab === 'rooms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {rooms.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center gap-4 rounded-xl border bg-card">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <Building2 className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div>
                <p className="font-medium text-muted-foreground">لا توجد قاعات مضافة بعد</p>
                <p className="text-xs text-muted-foreground mt-1">أضف أول قاعة اجتماعات لتتمكن من استقبال الحجوزات</p>
              </div>
              <Button onClick={openAddRoom} className="gap-1.5">
                <Plus className="h-4 w-4" /> إضافة أول قاعة
              </Button>
            </div>
          ) : rooms.map((room, i) => {
            const color = ROOM_COLORS[i % ROOM_COLORS.length]
            const todayCount = todayBookings.filter((b) => b.meeting_room_id === room.id).length
            return (
              <div key={room.id} className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
                {/* Image / color banner */}
                {room.images?.[0] ? (
                  <img
                    src={room.images[0]}
                    alt={room.name}
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-40 flex items-center justify-center"
                    style={{ backgroundColor: color + '20' }}
                  >
                    <Building2 className="h-10 w-10" style={{ color }} />
                  </div>
                )}

                {/* Content */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-base">{room.name}</h3>
                      {room.property && (
                        <p className="text-xs text-muted-foreground mt-0.5">{room.property.name}</p>
                      )}
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-1 rounded-full text-white"
                      style={{ backgroundColor: color }}
                    >
                      {room.hourly_rate ? `${room.hourly_rate} د.إ/ساعة` : '—'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {room.capacity && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        <span>{room.capacity} شخص</span>
                      </div>
                    )}
                    {todayCount > 0 && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>{todayCount} حجز اليوم</span>
                      </div>
                    )}
                  </div>

                  {/* Amenities */}
                  {room.amenities?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {room.amenities.slice(0, 4).map((a) => (
                        <span
                          key={a}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  )}

                  {room.half_day_rate || room.full_day_rate ? (
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {room.half_day_rate && <span>نصف يوم: {room.half_day_rate} د.إ</span>}
                      {room.full_day_rate && <span>يوم كامل: {room.full_day_rate} د.إ</span>}
                    </div>
                  ) : null}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 h-8 text-xs"
                      onClick={() => {
                        setDefaultDate(format(new Date(), 'yyyy-MM-dd'))
                        setDefaultHour(9)
                        setBookingOpen(true)
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      احجز
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                      onClick={() => openEditRoom(room)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      تعديل
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteRoom(room.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab: التقويم ── */}
      {tab === 'calendar' && (
        <BookingCalendar
          bookings={bookings}
          rooms={rooms}
          onBookingClick={(b) => handleBookingClick(b as Booking)}
          onSlotClick={handleSlotClick}
        />
      )}

      {/* ── Tab: حجوزات اليوم ── */}
      {tab === 'today' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              حجوزات {format(new Date(), 'EEEE d MMMM', { locale: ar })}
            </h2>
            <span className="text-sm text-muted-foreground">
              {todayBookings.filter((b) => b.status !== 'cancelled').length} حجز فعّال
            </span>
          </div>

          {todayBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border">
              <CalendarX className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">لا توجد حجوزات اليوم</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">القاعة</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحاجز</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">الوقت</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">الخدمات</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">المبلغ</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {todayBookings.map((booking) => {
                    const cfg    = statusConfig[booking.status as keyof typeof statusConfig]
                    const guestName = booking.tenant?.full_name ?? booking.visitor_name ?? '—'
                    const roomColor = roomColorMap.get(booking.meeting_room_id) ?? '#6B7280'
                    return (
                      <tr key={booking.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-sm shrink-0"
                              style={{ backgroundColor: roomColor }}
                            />
                            <span className="font-medium">{booking.meeting_room?.name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{guestName}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {format(parseISO(booking.start_time), 'HH:mm')} -{' '}
                              {format(parseISO(booking.end_time), 'HH:mm')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {booking.services?.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {(booking.services as string[]).map((s) => (
                                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted">
                                  {s === 'refreshments' ? 'مرطبات' : s === 'projector' ? 'بروجيكتور' : 'تسجيل'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {booking.amount ? `${booking.amount.toLocaleString('ar-AE')} د.إ` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${cfg?.cls ?? ''}`}>
                            {cfg?.label ?? booking.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {booking.status === 'confirmed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                              onClick={() => {
                                setSelectedBooking(booking)
                                setCancelOpen(true)
                              }}
                            >
                              إلغاء
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: تقرير الإيرادات ── */}
      {tab === 'revenue' && (
        <BusinessCenterStats
          totalRooms={rooms.length}
          todayCount={todayBookings.filter((b) => b.status !== 'cancelled').length}
          monthlyRevenue={monthlyRevenue}
          avgDurationHours={avgDuration}
          revenueByRoom={revenueByRoom}
        />
      )}

      {/* ── Dialogs ── */}
      <BookingFormDialog
        rooms={rooms}
        tenants={tenants}
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        onSuccess={() => router.refresh()}
        defaultDate={defaultDate}
        defaultHour={defaultHour}
      />

      <CancelBookingDialog
        booking={selectedBooking}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onSuccess={() => router.refresh()}
      />

      <RoomFormDialog
        key={selectedRoom?.id ?? 'new-room'}
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        onSuccess={() => router.refresh()}
        room={selectedRoom}
        properties={properties}
      />
    </div>
  )
}
