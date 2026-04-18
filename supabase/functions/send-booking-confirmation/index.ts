/**
 * Edge Function: send-booking-confirmation
 *
 * يُستدعى من Server Action عند إنشاء حجز جديد.
 *
 * Request Body (JSON):
 *   { booking_id: string }
 *
 * يجلب تفاصيل الحجز من DB ويُرسل بريد تأكيد للمستأجر.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY       = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL           = Deno.env.get('FROM_EMAIL') ?? 'noreply@yourdomain.com'
const APP_NAME             = Deno.env.get('APP_NAME') ?? 'Real Estate Manager'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  // Supabase يتحقق من الـ JWT تلقائياً — نتأكد فقط من وجود header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let bookingId: string
  try {
    const body = await req.json()
    bookingId = body.booking_id
    if (!bookingId) throw new Error('booking_id مطلوب')
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // جلب تفاصيل الحجز
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      id,
      start_time,
      end_time,
      booking_type,
      amount,
      status,
      meeting_room:meeting_rooms(name, capacity, property:properties(name)),
      tenant:tenants(full_name, email, phone)
    `)
    .eq('id', bookingId)
    .single()

  if (error || !booking) {
    return new Response(JSON.stringify({ error: 'الحجز غير موجود', detail: error?.message }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const tenant = Array.isArray(booking.tenant) ? booking.tenant[0] : booking.tenant
  const room   = Array.isArray(booking.meeting_room) ? booking.meeting_room[0] : booking.meeting_room

  if (!tenant?.email) {
    return new Response(JSON.stringify({ error: 'المستأجر ليس لديه بريد إلكتروني' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const bookingTypeAr: Record<string, string> = {
    hourly:   'بالساعة',
    half_day: 'نصف يوم',
    full_day: 'يوم كامل',
  }

  const startDate = new Date(booking.start_time)
  const endDate   = new Date(booking.end_time)

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [tenant.email],
      subject: `تأكيد حجز قاعة — ${room?.name ?? 'قاعة اجتماعات'}`,
      html: buildConfirmationEmail({
        tenantName:   tenant.full_name,
        roomName:     room?.name ?? 'قاعة اجتماعات',
        propertyName: (room?.property as { name?: string } | null)?.name ?? '',
        startTime:    startDate,
        endTime:      endDate,
        bookingType:  bookingTypeAr[booking.booking_type] ?? booking.booking_type,
        amount:       booking.amount ?? 0,
        appName:      APP_NAME,
      }),
    }),
  })

  if (!emailRes.ok) {
    const errText = await emailRes.text()
    return new Response(JSON.stringify({ error: 'فشل إرسال البريد', detail: errText }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true, email_sent_to: tenant.email }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── Email Template ─────────────────────────────────────────────

function buildConfirmationEmail(opts: {
  tenantName:   string | null
  roomName:     string
  propertyName: string
  startTime:    Date
  endTime:      Date
  bookingType:  string
  amount:       number
  appName:      string
}): string {
  const fmt = (d: Date) =>
    d.toLocaleString('ar-AE', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>تأكيد الحجز</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#059669;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:20px;">${opts.appName}</h1>
              <p style="margin:8px 0 0;color:#a7f3d0;font-size:14px;">تأكيد حجز قاعة الاجتماعات</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">
                عزيزي/عزيزتي <strong>${opts.tenantName ?? 'المستأجر'}</strong>،
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
                تم تأكيد حجزكم بنجاح. فيما يلي تفاصيل الحجز:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="5" cellspacing="0">
                      <tr>
                        <td style="color:#6b7280;font-size:13px;">القاعة</td>
                        <td align="left" style="font-weight:bold;color:#1f2937;font-size:14px;">${opts.roomName}${opts.propertyName ? ' — ' + opts.propertyName : ''}</td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280;font-size:13px;">نوع الحجز</td>
                        <td align="left" style="color:#1f2937;font-size:14px;">${opts.bookingType}</td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280;font-size:13px;">من</td>
                        <td align="left" style="color:#1f2937;font-size:14px;">${fmt(opts.startTime)}</td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280;font-size:13px;">إلى</td>
                        <td align="left" style="color:#1f2937;font-size:14px;">${fmt(opts.endTime)}</td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280;font-size:13px;">المبلغ</td>
                        <td align="left" style="font-weight:bold;color:#059669;font-size:16px;">${opts.amount.toLocaleString('ar-AE')} د.إ</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                للاستفسار أو الإلغاء، يرجى التواصل مع إدارة المبنى مسبقاً.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">${opts.appName} — جميع الحقوق محفوظة</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
