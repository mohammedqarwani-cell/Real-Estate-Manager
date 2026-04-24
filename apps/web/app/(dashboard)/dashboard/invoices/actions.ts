'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

// ─── Zod Schemas ────────────────────────────────────────────

const createInvoiceSchema = z.object({
  tenant_id:    z.string().uuid('يرجى اختيار مستأجر'),
  contract_id:  z.string().uuid().optional().nullable(),
  unit_id:      z.string().uuid().optional().nullable(),
  type:         z.enum(['rent', 'maintenance', 'utility', 'deposit', 'other']).default('rent'),
  amount:       z.coerce.number().positive('المبلغ يجب أن يكون موجباً'),
  tax_amount:   z.coerce.number().min(0).default(0),
  due_date:     z.string().min(1, 'تاريخ الاستحقاق مطلوب'),
  notes:        z.string().optional().nullable(),
})

const recordPaymentSchema = z.object({
  amount_paid:      z.coerce.number().positive('المبلغ يجب أن يكون موجباً'),
  payment_method:   z.enum(['cash', 'bank_transfer', 'cheque', 'card', 'online']),
  reference_number: z.string().optional().nullable(),
  paid_date:        z.string().min(1, 'تاريخ الدفع مطلوب'),
  notes:            z.string().optional().nullable(),
})

// ─── Types ──────────────────────────────────────────────────

export type InvoiceFormState = {
  success: boolean
  error: string | null
  fieldErrors: Record<string, string[]>
}

export type PaymentFormState = {
  success: boolean
  error: string | null
  fieldErrors: Record<string, string[]>
}

// ─── Actions ────────────────────────────────────────────────

export async function createInvoice(
  _prev: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  const raw = {
    tenant_id:   formData.get('tenant_id'),
    contract_id: formData.get('contract_id') || null,
    unit_id:     formData.get('unit_id') || null,
    type:        formData.get('type') || 'rent',
    amount:      formData.get('amount'),
    tax_amount:  formData.get('tax_amount') || '0',
    due_date:    formData.get('due_date'),
    notes:       formData.get('notes') || null,
  }

  const parsed = createInvoiceSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createServerClient()
  const q = supabase.from('invoices') as any
  const { error } = await q.insert({
    tenant_id:   parsed.data.tenant_id,
    contract_id: parsed.data.contract_id ?? null,
    unit_id:     parsed.data.unit_id ?? null,
    type:        parsed.data.type,
    amount:      parsed.data.amount,
    tax_amount:  parsed.data.tax_amount,
    due_date:    parsed.data.due_date,
    notes:       parsed.data.notes ?? null,
    status:      'pending',
  })

  if (error) {
    return { success: false, error: 'حدث خطأ أثناء إنشاء الفاتورة: ' + error.message, fieldErrors: {} }
  }

  revalidatePath('/dashboard/invoices')
  return { success: true, error: null, fieldErrors: {} }
}

export async function recordPayment(
  invoiceId: string,
  _prev: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const raw = {
    amount_paid:      formData.get('amount_paid'),
    payment_method:   formData.get('payment_method'),
    reference_number: formData.get('reference_number') || null,
    paid_date:        formData.get('paid_date'),
    notes:            formData.get('notes') || null,
  }

  const parsed = recordPaymentSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createServerClient()

  // Get invoice to compare amounts
  const { data: invoice } = await (supabase.from('invoices') as any)
    .select('total_amount, status')
    .eq('id', invoiceId)
    .single()

  if (!invoice) {
    return { success: false, error: 'الفاتورة غير موجودة', fieldErrors: {} }
  }

  if (['paid', 'cancelled'].includes(invoice.status)) {
    return { success: false, error: 'لا يمكن تسجيل دفعة لفاتورة مدفوعة أو ملغاة', fieldErrors: {} }
  }

  const newStatus =
    parsed.data.amount_paid >= invoice.total_amount ? 'paid' : 'partial'

  const q = supabase.from('invoices') as any
  const { error } = await q.update({
    status:           newStatus,
    payment_method:   parsed.data.payment_method,
    reference_number: parsed.data.reference_number ?? null,
    paid_date:        newStatus === 'paid' ? parsed.data.paid_date : null,
    notes:            parsed.data.notes ?? null,
  }).eq('id', invoiceId)

  if (error) {
    return { success: false, error: 'حدث خطأ أثناء تسجيل الدفعة: ' + error.message, fieldErrors: {} }
  }

  revalidatePath('/dashboard/invoices')
  return { success: true, error: null, fieldErrors: {} }
}

export async function generateMonthlyInvoices(
  year: number,
  month: number
): Promise<{ success: boolean; created: number; skipped: number; error: string | null }> {
  const supabase = await createServerClient()

  const { data, error } = await (supabase.rpc as any)('generate_monthly_invoices', {
    p_year:  year,
    p_month: month,
  })

  if (error) {
    return { success: false, created: 0, skipped: 0, error: error.message }
  }

  const rows = (data as any[]) ?? []
  const created = rows.filter((r) => !r.skipped).length
  const skipped = rows.filter((r) => r.skipped).length

  revalidatePath('/dashboard/invoices')
  return { success: true, created, skipped, error: null }
}

export async function generateAllSchedules(): Promise<{
  success: boolean
  created: number
  skipped: number
  error: string | null
}> {
  const supabase = await createServerClient()

  const { data, error } = await (supabase.rpc as any)('generate_all_invoices')

  if (error) {
    return { success: false, created: 0, skipped: 0, error: error.message }
  }

  const rows = (data as any[]) ?? []
  const created = rows.filter((r) => !r.skipped).length
  const skipped = rows.filter((r) => r.skipped).length

  revalidatePath('/dashboard/invoices')
  revalidatePath('/dashboard')
  return { success: true, created, skipped, error: null }
}

export async function cancelInvoice(
  invoiceId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerClient()

  const q = supabase.from('invoices') as any
  const { error } = await q.update({ status: 'cancelled' }).eq('id', invoiceId)

  if (error) {
    return { success: false, error: 'حدث خطأ: ' + error.message }
  }

  revalidatePath('/dashboard/invoices')
  return { success: true, error: null }
}
