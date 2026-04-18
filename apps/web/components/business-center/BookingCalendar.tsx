'use client'

import { useState, useMemo } from 'react'
import {
  format, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, eachDayOfInterval,
  startOfMonth, endOfMonth, isSameDay, isSameMonth,
  parseISO, getDay,
} from 'date-fns'
import { ar } from 'date-fns/locale'
import { ChevronRight, ChevronLeft, Calendar, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Constants ───────────────────────────────────────────────────

const START_HOUR  = 7
const END_HOUR    = 22
const HOUR_HEIGHT = 60   // px per hour
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT

const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

const ROOM_COLORS = [
  { bg: '#3B82F6', text: '#fff', light: 'rgba(59,130,246,0.15)' },
  { bg: '#10B981', text: '#fff', light: 'rgba(16,185,129,0.15)' },
  { bg: '#8B5CF6', text: '#fff', light: 'rgba(139,92,246,0.15)' },
  { bg: '#F59E0B', text: '#fff', light: 'rgba(245,158,11,0.15)' },
  { bg: '#EF4444', text: '#fff', light: 'rgba(239,68,68,0.15)' },
  { bg: '#06B6D4', text: '#fff', light: 'rgba(6,182,212,0.15)' },
  { bg: '#F97316', text: '#fff', light: 'rgba(249,115,22,0.15)' },
  { bg: '#EC4899', text: '#fff', light: 'rgba(236,72,153,0.15)' },
]

// ─── Helpers ─────────────────────────────────────────────────────

function getRoomColor(roomId: string, roomMap: Map<string, number>) {
  const idx = roomMap.get(roomId) ?? 0
  return ROOM_COLORS[idx % ROOM_COLORS.length]
}

function getBookingPosition(startISO: string, endISO: string) {
  const start = parseISO(startISO)
  const end   = parseISO(endISO)
  const startH = start.getHours() + start.getMinutes() / 60
  const endH   = end.getHours()   + end.getMinutes()   / 60
  const clampedStart = Math.max(startH, START_HOUR)
  const clampedEnd   = Math.min(endH,   END_HOUR)
  const top    = (clampedStart - START_HOUR) * HOUR_HEIGHT
  const height = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT, 22)
  return { top, height }
}

// ─── Props ───────────────────────────────────────────────────────

interface Booking {
  id:             string
  meeting_room_id: string
  start_time:     string
  end_time:       string
  booking_type:   string
  amount:         number | null
  status:         string
  visitor_name:   string | null
  meeting_room?:  { id: string; name: string } | null
  tenant?:        { full_name: string } | null
}

interface Room {
  id:   string
  name: string
}

interface Props {
  bookings:        Booking[]
  rooms:           Room[]
  onBookingClick?: (booking: Booking) => void
  onSlotClick?:    (date: Date, hour: number) => void
}

// ─── Main Component ──────────────────────────────────────────────

export function BookingCalendar({ bookings, rooms, onBookingClick, onSlotClick }: Props) {
  const [view,    setView]    = useState<'week' | 'month'>('week')
  const [current, setCurrent] = useState(new Date())

  // Room color index map
  const roomColorMap = useMemo(() => {
    const m = new Map<string, number>()
    rooms.forEach((r, i) => m.set(r.id, i))
    return m
  }, [rooms])

  // Active (non-cancelled) bookings
  const activeBookings = useMemo(
    () => bookings.filter((b) => b.status !== 'cancelled'),
    [bookings]
  )

  return (
    <div className="space-y-3" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrent((c) =>
                view === 'week' ? subWeeks(c, 1) : subMonths(c, 1)
              )
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrent(new Date())}
            className="px-3 text-xs"
          >
            اليوم
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrent((c) =>
                view === 'week' ? addWeeks(c, 1) : addMonths(c, 1)
              )
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <h3 className="text-sm font-semibold">
          {view === 'week'
            ? `${format(startOfWeek(current, { weekStartsOn: 0 }), 'd MMM', { locale: ar })} — ${format(endOfWeek(current, { weekStartsOn: 0 }), 'd MMM yyyy', { locale: ar })}`
            : format(current, 'MMMM yyyy', { locale: ar })}
        </h3>

        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          <button
            onClick={() => setView('week')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              view === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            أسبوعي
          </button>
          <button
            onClick={() => setView('month')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              view === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            شهري
          </button>
        </div>
      </div>

      {/* Room Legend */}
      {rooms.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {rooms.map((room) => {
            const color = getRoomColor(room.id, roomColorMap)
            return (
              <div key={room.id} className="flex items-center gap-1.5 text-xs">
                <span
                  className="inline-block h-3 w-3 rounded-sm shrink-0"
                  style={{ backgroundColor: color.bg }}
                />
                {room.name}
              </div>
            )
          })}
        </div>
      )}

      {/* Calendar Body */}
      {view === 'week'
        ? <WeekView current={current} bookings={activeBookings} roomColorMap={roomColorMap} onBookingClick={onBookingClick} onSlotClick={onSlotClick} />
        : <MonthView current={current} bookings={activeBookings} roomColorMap={roomColorMap} onBookingClick={onBookingClick} setCurrent={setCurrent} setView={setView} />
      }
    </div>
  )
}

// ─── Week View ───────────────────────────────────────────────────

function WeekView({
  current,
  bookings,
  roomColorMap,
  onBookingClick,
  onSlotClick,
}: {
  current:         Date
  bookings:        Booking[]
  roomColorMap:    Map<string, number>
  onBookingClick?: (b: Booking) => void
  onSlotClick?:    (d: Date, h: number) => void
}) {
  const weekStart = startOfWeek(current, { weekStartsOn: 0 }) // Sunday
  const days      = eachDayOfInterval({ start: weekStart, end: endOfWeek(current, { weekStartsOn: 0 }) })
  const today     = new Date()

  function getDayBookings(day: Date) {
    return bookings.filter((b) => isSameDay(parseISO(b.start_time), day))
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Day headers */}
      <div className="flex border-b bg-muted/30 sticky top-0 z-10">
        <div className="w-14 shrink-0 border-r" />
        {days.map((day) => {
          const isToday = isSameDay(day, today)
          return (
            <div key={day.toISOString()} className="flex-1 text-center py-2 border-r last:border-r-0">
              <p className={`text-[11px] font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                {format(day, 'EEE', { locale: ar })}
              </p>
              <p className={`text-sm font-bold mt-0.5 leading-none w-6 h-6 rounded-full flex items-center justify-center mx-auto ${
                isToday ? 'bg-primary text-primary-foreground' : ''
              }`}>
                {format(day, 'd')}
              </p>
            </div>
          )
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
        <div className="flex">
          {/* Time labels */}
          <div className="w-14 shrink-0 border-r relative bg-background" style={{ height: TOTAL_HEIGHT }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute text-[10px] text-muted-foreground text-left pl-1 leading-none"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 6 }}
              >
                {h}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayBookings = getDayBookings(day)
            const isToday = isSameDay(day, today)
            return (
              <div
                key={day.toISOString()}
                className={`flex-1 relative border-r last:border-r-0 cursor-pointer ${isToday ? 'bg-primary/[0.03]' : 'bg-background'}`}
                style={{ height: TOTAL_HEIGHT }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('[data-booking]')) return
                  if (onSlotClick) {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const y = e.clientY - rect.top
                    const hour = Math.floor(y / HOUR_HEIGHT) + START_HOUR
                    onSlotClick(day, Math.min(Math.max(hour, START_HOUR), END_HOUR - 1))
                  }
                }}
              >
                {/* Hour lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-border/40"
                    style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                  />
                ))}

                {/* Bookings */}
                {dayBookings.map((booking) => {
                  const { top, height } = getBookingPosition(booking.start_time, booking.end_time)
                  const color = getRoomColor(booking.meeting_room_id, roomColorMap)
                  const guestName = booking.tenant?.full_name ?? booking.visitor_name ?? ''
                  return (
                    <div
                      key={booking.id}
                      data-booking="1"
                      onClick={(e) => { e.stopPropagation(); onBookingClick?.(booking) }}
                      className="absolute inset-x-0.5 rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity select-none"
                      style={{ top, height, backgroundColor: color.bg, color: color.text, zIndex: 1 }}
                      title={`${booking.meeting_room?.name} — ${guestName}`}
                    >
                      <div className="px-1 py-0.5 h-full flex flex-col justify-start overflow-hidden">
                        <p className="text-[10px] font-semibold leading-tight truncate">
                          {booking.meeting_room?.name}
                        </p>
                        {height >= 36 && (
                          <p className="text-[9px] opacity-90 leading-tight truncate">
                            {format(parseISO(booking.start_time), 'HH:mm')}–
                            {format(parseISO(booking.end_time), 'HH:mm')}
                          </p>
                        )}
                        {height >= 52 && guestName && (
                          <p className="text-[9px] opacity-80 truncate">{guestName}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Month View ──────────────────────────────────────────────────

function MonthView({
  current,
  bookings,
  roomColorMap,
  onBookingClick,
  setCurrent,
  setView,
}: {
  current:         Date
  bookings:        Booking[]
  roomColorMap:    Map<string, number>
  onBookingClick?: (b: Booking) => void
  setCurrent:      (d: Date) => void
  setView:         (v: 'week' | 'month') => void
}) {
  const monthStart  = startOfMonth(current)
  const monthEnd    = endOfMonth(current)
  const gridStart   = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd     = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days        = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const today       = new Date()
  const DAY_NAMES   = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب']

  function getDayBookings(day: Date) {
    return bookings.filter((b) => isSameDay(parseISO(b.start_time), day))
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center py-2 text-[11px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const isToday      = isSameDay(day, today)
          const isCurrentMon = isSameMonth(day, current)
          const dayBookings  = getDayBookings(day)

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[90px] border-b border-r last:border-r-0 p-1 cursor-pointer hover:bg-muted/30 transition-colors ${
                !isCurrentMon ? 'opacity-40' : ''
              }`}
              onClick={() => {
                setCurrent(day)
                setView('week')
              }}
            >
              {/* Day number */}
              <div className="flex justify-center mb-1">
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                }`}>
                  {format(day, 'd')}
                </span>
              </div>

              {/* Booking dots / pills */}
              <div className="space-y-0.5 overflow-hidden">
                {dayBookings.slice(0, 3).map((b) => {
                  const color = getRoomColor(b.meeting_room_id, roomColorMap)
                  return (
                    <div
                      key={b.id}
                      onClick={(e) => { e.stopPropagation(); onBookingClick?.(b) }}
                      className="rounded px-1 py-0.5 text-[9px] font-medium truncate leading-tight hover:opacity-80"
                      style={{ backgroundColor: color.bg, color: color.text }}
                    >
                      {format(parseISO(b.start_time), 'HH:mm')}{' '}
                      {b.meeting_room?.name}
                    </div>
                  )
                })}
                {dayBookings.length > 3 && (
                  <p className="text-[9px] text-muted-foreground pr-1">
                    +{dayBookings.length - 3} أخرى
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
