/**
 * Edge Function: send-whatsapp (اختياري)
 *
 * يُرسل رسالة WhatsApp عبر Twilio للمستأجرين بتذكير الإيجار المستحق.
 *
 * متطلبات:
 *   - حساب Twilio مع WhatsApp Sandbox أو رقم مُعتمد
 *   - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 *
 * Request Body (JSON):
 *   { invoice_id: string }
 *   أو
 *   { tenant_phone: string, message: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TWILIO_ACCOUNT_SID  = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
const TWILIO_AUTH_TOKEN   = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
const TWILIO_FROM         = Deno.env.get('TWILIO_WHATSAPP_FROM') ?? 'whatsapp:+14155238886'

// ── Helper: إرسال رسالة WhatsApp عبر Twilio ──────────────────
async function sendWhatsApp(to: string, messageBody: string): Promise<Response> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'Twilio credentials غير مُعدَّة — أضف TWILIO_ACCOUNT_SID و TWILIO_AUTH_TOKEN في Secrets' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  const twilioUrl  = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`

  const twilioRes = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
    },
    body: new URLSearchParams({ From: TWILIO_FROM, To: toWhatsApp, Body: messageBody }).toString(),
  })

  if (!twilioRes.ok) {
    const errText = await twilioRes.text()
    return new Response(
      JSON.stringify({ error: 'فشل إرسال WhatsApp', detail: errText }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const twilioData = await twilioRes.json()
  return new Response(
    JSON.stringify({ success: true, sid: twilioData.sid, to: toWhatsApp }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

// ── Helpers ───────────────────────────────────────────────────
function formatPhone(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, '')
  if (p.startsWith('0')) p = '+971' + p.slice(1)
  if (!p.startsWith('+')) p = '+' + p
  return p
}

function buildReminderMessage(opts: {
  tenantName:    string | null
  invoiceNumber: string
  amount:        number
  dueDate:       string
}): string {
  return [
    `مرحباً ${opts.tenantName ?? 'عزيزنا المستأجر'}،`,
    '',
    `نودّ تذكيركم بأن فاتورتكم رقم *${opts.invoiceNumber}* بمبلغ *${opts.amount.toLocaleString('ar-AE')} د.إ* مستحقة بتاريخ *${opts.dueDate}*.`,
    '',
    'يُرجى السداد في الموعد المحدد لتفادي أي رسوم إضافية.',
    '',
    'شكراً لتعاملكم معنا. 🏢',
  ].join('\n')
}

// ── Main Handler ──────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body: { invoice_id?: string; tenant_phone?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Mode 1: إرسال مباشر برقم + رسالة ────────────────────────
  if (body.tenant_phone && body.message) {
    return await sendWhatsApp(body.tenant_phone, body.message)
  }

  // ── Mode 2: جلب بيانات الفاتورة من DB ────────────────────────
  if (!body.invoice_id) {
    return new Response(
      JSON.stringify({ error: 'invoice_id أو (tenant_phone + message) مطلوب' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('invoice_number, total_amount, due_date, tenant:tenants(full_name, phone)')
    .eq('id', body.invoice_id)
    .single()

  if (error || !invoice) {
    return new Response(
      JSON.stringify({ error: 'الفاتورة غير موجودة', detail: error?.message }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const tenant = Array.isArray(invoice.tenant) ? invoice.tenant[0] : invoice.tenant as { full_name: string | null; phone: string | null } | null

  if (!tenant?.phone) {
    return new Response(
      JSON.stringify({ error: 'المستأجر ليس لديه رقم هاتف' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return await sendWhatsApp(
    formatPhone(tenant.phone),
    buildReminderMessage({
      tenantName:    tenant.full_name,
      invoiceNumber: invoice.invoice_number,
      amount:        invoice.total_amount,
      dueDate:       invoice.due_date,
    })
  )
})
