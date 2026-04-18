/**
 * Edge Function: weekly-admin-report
 *
 * يُستدعى أسبوعياً (كل اثنين الساعة 08:00 توقيت الإمارات).
 * يُرسل ملخصاً أسبوعياً لجميع مستخدمي admin بالبريد الإلكتروني.
 *
 * إعداد Cron في Supabase Dashboard:
 *   Function: weekly-admin-report
 *   Schedule: 0 4 * * 1   (Monday 08:00 Dubai = 04:00 UTC)
 *   HTTP Method: POST
 *   Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY       = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL           = Deno.env.get('FROM_EMAIL') ?? 'noreply@yourdomain.com'
const APP_NAME             = Deno.env.get('APP_NAME') ?? 'Real Estate Manager'

Deno.serve(async (req) => {
  // Supabase يتحقق من الـ JWT تلقائياً — نتأكد فقط من وجود header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // نطاق الأسبوع الماضي
  const now       = new Date()
  const weekAgo   = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString()

  // ── جلب البيانات بالتوازي ────────────────────────────────────
  const [
    { count: newBookings },
    { count: newMaintenance },
    { count: overdueInvoices },
    { data: paidInvoices },
    { count: expiringContracts },
    { data: admins },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgoStr),

    supabase
      .from('maintenance_requests')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgoStr),

    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'overdue'),

    supabase
      .from('invoices')
      .select('total_amount')
      .eq('status', 'paid')
      .gte('paid_date', weekAgo.toISOString().split('T')[0]),

    supabase
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .lte('end_date', new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),

    // جلب admin emails من profiles + auth.users (نستخدم service role)
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['admin']),
  ])

  const weeklyRevenue = (paidInvoices ?? []).reduce(
    (sum, inv) => sum + (inv.total_amount ?? 0),
    0
  )

  if (!admins || admins.length === 0) {
    return new Response(JSON.stringify({ error: 'لا يوجد admin', sent: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // جلب بريد كل admin من auth.users (يتطلب service role)
  const adminEmails: Array<{ name: string; email: string }> = []
  for (const admin of admins) {
    try {
      const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(admin.id)
      if (userError) {
        console.error(`[weekly-report] Failed to get email for admin ${admin.id}:`, userError.message)
        continue
      }
      if (authUser?.user?.email) {
        adminEmails.push({ name: admin.full_name ?? 'المدير', email: authUser.user.email })
      }
    } catch (err) {
      console.error(`[weekly-report] Unexpected error for admin ${admin.id}:`, err)
    }
  }

  const stats = {
    newBookings:       newBookings ?? 0,
    newMaintenance:    newMaintenance ?? 0,
    overdueInvoices:   overdueInvoices ?? 0,
    weeklyRevenue,
    expiringContracts: expiringContracts ?? 0,
  }

  const weekLabel = `${weekAgo.toLocaleDateString('ar-AE')} — ${now.toLocaleDateString('ar-AE')}`

  let emailsSent = 0
  for (const admin of adminEmails) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${APP_NAME} <${FROM_EMAIL}>`,
        to: [admin.email],
        subject: `التقرير الأسبوعي — ${weekLabel}`,
        html: buildWeeklyReportEmail({ ...stats, adminName: admin.name, weekLabel, appName: APP_NAME }),
      }),
    })
    if (res.ok) emailsSent++
  }

  return new Response(JSON.stringify({ success: true, emails_sent: emailsSent, stats }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── Email Template ─────────────────────────────────────────────

function buildWeeklyReportEmail(opts: {
  adminName:        string
  weekLabel:        string
  newBookings:      number
  newMaintenance:   number
  overdueInvoices:  number
  weeklyRevenue:    number
  expiringContracts: number
  appName:          string
}): string {
  const statRow = (label: string, value: string, color = '#1f2937') => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">${label}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-weight:bold;color:${color};font-size:15px;text-align:left;">${value}</td>
    </tr>
  `

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>التقرير الأسبوعي</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#1e40af;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:20px;">${opts.appName}</h1>
              <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">التقرير الأسبوعي — ${opts.weekLabel}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 24px;font-size:16px;color:#1f2937;">
                مرحباً <strong>${opts.adminName}</strong>، فيما يلي ملخص الأسبوع الماضي:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
                ${statRow('الإيرادات المحصّلة هذا الأسبوع', opts.weeklyRevenue.toLocaleString('ar-AE') + ' د.إ', '#059669')}
                ${statRow('حجوزات القاعات الجديدة', String(opts.newBookings))}
                ${statRow('طلبات الصيانة الجديدة', String(opts.newMaintenance))}
                ${statRow('الفواتير المتأخرة (إجمالي)', String(opts.overdueInvoices), opts.overdueInvoices > 0 ? '#dc2626' : '#1f2937')}
                ${statRow('عقود تنتهي خلال 30 يوم', String(opts.expiringContracts), opts.expiringContracts > 0 ? '#d97706' : '#1f2937')}
              </table>
              ${opts.overdueInvoices > 0 ? `
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:16px;">
                <p style="margin:0;font-size:14px;color:#dc2626;">
                  ⚠️ يوجد <strong>${opts.overdueInvoices}</strong> فاتورة متأخرة تحتاج متابعة عاجلة.
                </p>
              </div>` : ''}
              ${opts.expiringContracts > 0 ? `
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;">
                <p style="margin:0;font-size:14px;color:#d97706;">
                  📋 يوجد <strong>${opts.expiringContracts}</strong> عقد ينتهي خلال 30 يوماً — يُنصح بالتجديد مسبقاً.
                </p>
              </div>` : ''}
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">${opts.appName} — تقرير تلقائي أسبوعي</p>
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
