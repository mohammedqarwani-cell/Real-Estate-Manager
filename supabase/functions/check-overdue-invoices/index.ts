/**
 * Edge Function: check-overdue-invoices
 *
 * يُستدعى يومياً عبر Supabase Cron (أو pg_cron).
 * الوظائف:
 *   1. تشغيل check_and_notify_overdue_invoices() في DB
 *   2. تشغيل check_and_notify_expiring_contracts() في DB
 *   3. إرسال بريد تذكير لكل فاتورة تستحق خلال 7 أيام (Resend)
 *
 * إعداد Cron في Supabase Dashboard:
 *   Function: check-overdue-invoices
 *   Schedule: 0 4 * * *   (08:00 توقيت الإمارات = 04:00 UTC)
 *   HTTP Method: POST
 *   Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY        = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL            = Deno.env.get('FROM_EMAIL') ?? 'noreply@yourdomain.com'
const APP_NAME              = Deno.env.get('APP_NAME') ?? 'Real Estate Manager'

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
  const results: Record<string, unknown> = {}

  // ── 1. فحص الفواتير المتأخرة وإنشاء الإشعارات ──────────────
  try {
    const { data: overdueCount, error } = await supabase.rpc('check_and_notify_overdue_invoices')
    if (error) throw error
    results.overdue_notifications_created = overdueCount
  } catch (err) {
    results.overdue_error = String(err)
  }

  // ── 2. فحص العقود المنتهية وإنشاء الإشعارات ─────────────────
  try {
    const { data: expiringCount, error } = await supabase.rpc('check_and_notify_expiring_contracts')
    if (error) throw error
    results.expiring_notifications_created = expiringCount
  } catch (err) {
    results.expiring_error = String(err)
  }

  // ── 3. تذكيرات البريد للفواتير المستحقة خلال 7 أيام ──────────
  try {
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    const dueDateStr = sevenDaysFromNow.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    const { data: upcomingInvoices, error } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        total_amount,
        due_date,
        tenant:tenants(full_name, email)
      `)
      .in('status', ['pending', 'draft'])
      .gte('due_date', today)
      .lte('due_date', dueDateStr)

    if (error) throw error

    let emailsSent = 0
    for (const invoice of (upcomingInvoices ?? [])) {
      const tenant = Array.isArray(invoice.tenant) ? invoice.tenant[0] : invoice.tenant
      if (!tenant?.email) continue

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `${APP_NAME} <${FROM_EMAIL}>`,
          to: [tenant.email],
          subject: `تذكير: فاتورة مستحقة خلال 7 أيام — ${invoice.invoice_number}`,
          html: buildReminderEmail({
            tenantName: tenant.full_name,
            invoiceNumber: invoice.invoice_number,
            totalAmount: invoice.total_amount,
            dueDate: invoice.due_date,
            appName: APP_NAME,
          }),
        }),
      })

      if (emailRes.ok) emailsSent++
    }

    results.reminder_emails_sent = emailsSent
  } catch (err) {
    results.email_error = String(err)
  }

  return new Response(JSON.stringify({ success: true, ...results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── Email Templates ───────────────────────────────────────────

function buildReminderEmail(opts: {
  tenantName: string | null
  invoiceNumber: string
  totalAmount: number
  dueDate: string
  appName: string
}): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تذكير بالفاتورة</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#2563eb;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:20px;">${opts.appName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">
                عزيزي/عزيزتي <strong>${opts.tenantName ?? 'المستأجر'}</strong>،
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
                نودّ تذكيركم بأن لديكم فاتورة مستحقة السداد خلال <strong>7 أيام</strong>.
              </p>
              <!-- Invoice Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="4" cellspacing="0">
                      <tr>
                        <td style="color:#6b7280;font-size:13px;">رقم الفاتورة</td>
                        <td align="left" style="font-weight:bold;color:#1f2937;font-size:14px;">${opts.invoiceNumber}</td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280;font-size:13px;">المبلغ المستحق</td>
                        <td align="left" style="font-weight:bold;color:#dc2626;font-size:16px;">${opts.totalAmount.toLocaleString('ar-AE')} د.إ</td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280;font-size:13px;">تاريخ الاستحقاق</td>
                        <td align="left" style="font-weight:bold;color:#1f2937;font-size:14px;">${opts.dueDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                يُرجى السداد قبل تاريخ الاستحقاق لتفادي أي رسوم إضافية.
                للاستفسار، يرجى التواصل معنا.
              </p>
            </td>
          </tr>
          <!-- Footer -->
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
