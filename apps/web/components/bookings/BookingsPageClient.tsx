'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  CalendarCheck, Clock, TrendingUp, Plus, Building2,
  Users, Pencil, Trash2, LayoutGrid,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BookingFormDialog } from './BookingFormDialog'
import { UpdateBookingDialog } from './UpdateBookingDialog'
import { MeetingRoomFormDialog } from './MeetingRoomFormDialog'
import { deleteMeetingRoom } from '@/app/(dashboard)/dashboard/bookings/actions'

// ─── Types ──────────────────────────────────────────────────

interface Property { id: string; name: string }
interface Tenant   { id: string; full_name: string; phone?: string | null }

interface Room {
  id: string; name: string; capacity: number | null
  hourly_rate: number | null; half_day_rate: number | null; full_day_rate: number | null
  status: string; description: string | null; amenities: string[]
  property: Property | null
}

interface Booking {
  id: string; booking_type: string; start_time: string; end_time: string
  amount: number | null; status: string; notes: string | null
  meeting_room: (Room & { property: Property | null }) | null
  tenant: Pick<Tenant, 'id' | 'full_name'> | null
}

interface Props {
  bookings: Booking[]; rooms: Room[]; properties: Property[]; tenants: Tenant[]
  todayCount: number; upcomingCount: number; monthRevenue: number
}

// ─── Config ─────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending:   { label: 'معلق',   class: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'مؤكد',   class: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغي',   class: 'bg-red-100 text-red-700' },
  completed: { label: 'منتهٍ',  class: 'bg-gray-100 text-gray-500' },
}

const TYPE_LABELS: Record<string, string> = {
  hourly: 'بالساعة', half_day: 'نصف يوم', full_day: 'يوم كامل',
}

const ROOM_STATUS: Record<string, { label: string; class: string }> = {
  available:   { label: 'متاحة',     class: 'bg-green-100 text-green-700' },
  unavailable: { label: 'غير متاحة', class: 'bg-red-100 text-red-700' },
  maintenance: { label: 'صيانة',     class: 'bg-orange-100 text-orange-700' },
}

// ─── Component ──────────────────────────────────────────────

export function BookingsPageClient({
  bookings, rooms, properties, tenants,
  todayCount, upcomingCount, monthRevenue,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [tab, setTab] = useState<'bookings' | 'rooms'>('bookings')

  // Filters
  const [filterProperty, setFilterProperty] = useState('all')
  const [filterStatus,   setFilterStatus]   = useState('all')

  // Booking dialogs
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [updateDialogOpen,  setUpdateDialogOpen]  = useState(false)
  const [selectedBooking,   setSelectedBooking]   = useState<Booking | null>(null)

  // Room dialog
  const [roomDialogOpen, setRoomDialogOpen] = useState(false)
  const [selectedRoom,   setSelectedRoom]   = useState<Room | null>(null)

  const filteredBookings = useMemo(() => bookings.filter((b) => {
    if (filterStatus   !== 'all' && b.status !== filterStatus) return false
    if (filterProperty !== 'all' && (b.meeting_room as any)?.property?.id !== filterProperty) return false
    return true
  }), [bookings, filterStatus, filterProperty])

  function openUpdateBooking(b: Booking) {
    setSelectedBooking(b)
    setUpdateDialogOpen(true)
  }

  function openAddRoom() {
    setSelectedRoom(null)
    setRoomDialogOpen(true)
  }

  function openEditRoom(r: Room) {
    setSelectedRoom(r)
    setRoomDialogOpen(true)
  }

  async function handleDeleteRoom(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذه القاعة؟')) return
    const result = await deleteMeetingRoom(id)
    if (result.success) { toast.success('تم حذف القاعة'); router.refresh() }
    else toast.error(result.error ?? 'حدث خطأ')
  }

  const onSuccess = () => router.refresh()

  // ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: 'حجوزات اليوم',    value: String(todayCount),    icon: CalendarCheck, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'حجوزات قادمة',    value: String(upcomingCount), icon: Clock,         color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'القاعات المسجلة', value: String(rooms.length),  icon: Building2,     color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'إيراد هذا الشهر', value: `${monthRevenue.toLocaleString('ar-AE')} د.إ`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
        ] as const).map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border bg-card p-4 flex items-center gap-4">
            <div className={`h-10 w-10 rounded-full ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b">
        <div className="flex">
          {([
            { key: 'bookings', label: 'الحجوزات', count: bookings.length },
            { key: 'rooms',    label: 'القاعات',   count: rooms.length },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              <span className={`mr-2 text-xs px-1.5 py-0.5 rounded-full ${
                tab === key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Action buttons — always visible */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={openAddRoom} className="gap-1.5">
            <Plus className="h-4 w-4" /> إضافة قاعة
          </Button>
          <Button size="sm" onClick={() => setBookingDialogOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> حجز جديد
          </Button>
        </div>
      </div>

      {/* ── Bookings Tab ─────────────────────────────────────── */}
      {tab === 'bookings' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
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

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue placeholder="كل الحالات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="confirmed">مؤكد</SelectItem>
                <SelectItem value="pending">معلق</SelectItem>
                <SelectItem value="completed">منتهٍ</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            {filteredBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <CalendarCheck className="h-12 w-12 text-muted-foreground/20" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">لا توجد حجوزات</p>
                  {rooms.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      أضف قاعة أولاً من تبويب{' '}
                      <button
                        onClick={() => setTab('rooms')}
                        className="text-primary underline underline-offset-2"
                      >
                        القاعات
                      </button>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground text-xs">
                      <th className="text-right px-4 py-3 font-medium">القاعة</th>
                      <th className="text-right px-4 py-3 font-medium">المستأجر</th>
                      <th className="text-right px-4 py-3 font-medium">التاريخ والوقت</th>
                      <th className="text-right px-4 py-3 font-medium">نوع الحجز</th>
                      <th className="text-right px-4 py-3 font-medium">المبلغ</th>
                      <th className="text-right px-4 py-3 font-medium">الحالة</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredBookings.map((b) => {
                      const st = STATUS_CONFIG[b.status]
                      return (
                        <tr
                          key={b.id}
                          className="hover:bg-muted/30 cursor-pointer"
                          onClick={() => openUpdateBooking(b)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-sm">{b.meeting_room?.name ?? '—'}</div>
                            <div className="text-xs text-muted-foreground">{(b.meeting_room as any)?.property?.name}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">{b.tenant?.full_name ?? '—'}</td>
                          <td className="px-4 py-3">
                            <div className="text-sm">{format(new Date(b.start_time), 'dd MMM yyyy', { locale: ar })}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {format(new Date(b.start_time), 'HH:mm')} – {format(new Date(b.end_time), 'HH:mm')}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {TYPE_LABELS[b.booking_type] ?? b.booking_type}
                          </td>
                          <td className="px-4 py-3 font-medium text-sm">
                            {b.amount != null ? `${b.amount.toLocaleString('ar-AE')} د.إ` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {st && <span className={`text-xs px-2.5 py-0.5 rounded-full ${st.class}`}>{st.label}</span>}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={(e) => { e.stopPropagation(); openUpdateBooking(b) }}
                            >
                              تحديث
                            </Button>
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

      {/* ── Rooms Tab ────────────────────────────────────────── */}
      {tab === 'rooms' && (
        <div className="space-y-4">
          {rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-xl border bg-card gap-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <LayoutGrid className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div className="text-center">
                <p className="font-medium text-muted-foreground">لا توجد قاعات بعد</p>
                <p className="text-xs text-muted-foreground mt-1">أضف أول قاعة اجتماعات لتتمكن من استقبال الحجوزات</p>
              </div>
              <Button onClick={openAddRoom} className="gap-1.5">
                <Plus className="h-4 w-4" /> إضافة أول قاعة
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rooms.map((room) => {
                const st = ROOM_STATUS[room.status] ?? { label: room.status, class: 'bg-gray-100 text-gray-600' }
                const bookingCount = bookings.filter(
                  (b) => b.meeting_room?.id === room.id && b.status !== 'cancelled'
                ).length
                return (
                  <div key={room.id} className="rounded-xl border bg-card p-5 space-y-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-base">{room.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{(room as any).property?.name}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${st.class}`}>{st.label}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>{room.capacity ? `${room.capacity} شخص` : 'سعة غير محددة'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarCheck className="h-3.5 w-3.5" />
                        <span>{bookingCount} حجز</span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted/40 p-3 grid grid-cols-3 gap-2 text-center text-xs">
                      {[
                        { label: 'ساعي',     value: room.hourly_rate },
                        { label: 'نصف يوم',  value: room.half_day_rate },
                        { label: 'يوم كامل', value: room.full_day_rate },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-muted-foreground">{label}</p>
                          <p className="font-semibold mt-0.5">
                            {value != null ? `${value.toLocaleString('ar-AE')} د.إ` : '—'}
                          </p>
                        </div>
                      ))}
                    </div>

                    {room.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{room.description}</p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm" variant="outline" className="flex-1 gap-1.5 h-8 text-xs"
                        onClick={() => openEditRoom(room)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> تعديل
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteRoom(room.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Dialogs ──────────────────────────────────────────── */}
      <BookingFormDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        onSuccess={onSuccess}
        rooms={rooms}
        tenants={tenants}
      />

      {selectedBooking && (
        <UpdateBookingDialog
          key={selectedBooking.id}
          open={updateDialogOpen}
          onOpenChange={setUpdateDialogOpen}
          onSuccess={onSuccess}
          booking={selectedBooking}
        />
      )}

      <MeetingRoomFormDialog
        key={selectedRoom?.id ?? 'new-room'}
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        onSuccess={onSuccess}
        room={selectedRoom}
        properties={properties}
      />
    </div>
  )
}
