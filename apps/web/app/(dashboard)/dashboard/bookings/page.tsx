import { createServerClient } from '@/lib/supabase/server'
import { CalendarCheck, Plus, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

export const metadata = { title: 'الحجوزات' }

const statusConfig = {
  pending:   { label: 'معلق',   class: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'مؤكد',   class: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغي',   class: 'bg-red-100 text-red-700' },
  completed: { label: 'منتهي',  class: 'bg-gray-100 text-gray-600' },
}

export default async function BookingsPage() {
  const supabase = await createServerClient()
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      *,
      meeting_room:meeting_rooms(id, name, property:properties(id, name)),
      tenant:tenants(id, full_name)
    `)
    .order('start_time', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">حجوزات قاعات الاجتماعات</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة حجوزات القاعات والمرافق</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          حجز جديد
        </button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">القاعة</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المستأجر</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ والوقت</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">نوع الحجز</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المبلغ</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {bookings && bookings.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <CalendarCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">لا توجد حجوزات بعد</p>
                </td>
              </tr>
            ) : (
              bookings?.map((booking) => {
                const status = statusConfig[booking.status as keyof typeof statusConfig]
                return (
                  <tr key={booking.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{(booking.meeting_room as any)?.name}</p>
                        <p className="text-xs text-muted-foreground">{(booking.meeting_room as any)?.property?.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{(booking.tenant as any)?.full_name ?? 'غير محدد'}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p>{format(new Date(booking.start_time), 'dd MMM yyyy', { locale: ar })}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {format(new Date(booking.start_time), 'HH:mm')} - {format(new Date(booking.end_time), 'HH:mm')}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {booking.booking_type === 'hourly' ? 'بالساعة' :
                       booking.booking_type === 'half_day' ? 'نصف يوم' : 'يوم كامل'}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {booking.amount ? `${booking.amount.toLocaleString('ar-SA')} ر.س` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${status?.class}`}>
                        {status?.label}
                      </span>
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
