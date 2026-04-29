'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getUserCompanyId } from '@/lib/supabase/company'

const scheduleItemSchema = z.object({
  due_date: z.string(),
  amount:   z.number(),
})

const contractSchema = z.object({
  unit_id:        z.string().uuid('يرجى اختيار وحدة'),
  tenant_id:      z.string().uuid('يرجى اختيار مستأجر'),
  contract_type:  z.enum(['full_time', 'part_time']).default('full_time'),
  start_date:     z.string().min(1, 'تاريخ البداية مطلوب'),
  end_date:       z.string().min(1, 'تاريخ النهاية مطلوب'),
  total_amount:   z.coerce.number().positive('إجمالي الإيجار يجب أن يكون موجباً'),
  payment_count:  z.coerce.number().int().min(1).max(365),
  payment_amount: z.coerce.number().positive(),
  security_deposit: z.coerce.number().min(0).default(0),
  terms:          z.string().optional().nullable(),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية', path: ['end_date'] }
)

export type ContractFormState = {
  success:     boolean
  error:       string | null
  fieldErrors: Record<string, string[]>
}

export async function createContract(
  _prev: ContractFormState,
  formData: FormData
): Promise<ContractFormState> {
  const raw = {
    unit_id:          formData.get('unit_id'),
    tenant_id:        formData.get('tenant_id'),
    contract_type:    formData.get('contract_type') || 'full_time',
    start_date:       formData.get('start_date'),
    end_date:         formData.get('end_date'),
    total_amount:     formData.get('total_amount'),
    payment_count:    formData.get('payment_count'),
    payment_amount:   formData.get('payment_amount'),
    security_deposit: formData.get('security_deposit') || '0',
    terms:            formData.get('terms') || null,
  }

  const parsed = contractSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success:     false,
      error:       'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // Parse schedule
  let schedule: z.infer<typeof scheduleItemSchema>[] = []
  const scheduleRaw = formData.get('schedule')
  if (scheduleRaw && typeof scheduleRaw === 'string') {
    try {
      const arr = JSON.parse(scheduleRaw)
      const result = z.array(scheduleItemSchema).safeParse(arr)
      if (result.success) schedule = result.data
    } catch {
      // schedule stays empty — will still create contract without auto-invoices
    }
  }

  const supabase = await createServerClient()
  const company_id = await getUserCompanyId()

  // Check unit availability
  const { data: unit } = await (supabase.from('units') as any)
    .select('status, unit_number')
    .eq('id', parsed.data.unit_id)
    .single()

  if (unit?.status === 'occupied') {
    return {
      success:     false,
      error:       `الوحدة ${unit?.unit_number} مؤجرة حالياً، يرجى اختيار وحدة أخرى`,
      fieldErrors: {},
    }
  }

  // monthly_rent for backward compat = total_amount / 12
  const monthly_rent = Math.round((parsed.data.total_amount / 12) * 100) / 100

  // Insert contract
  const q = supabase.from('contracts') as any
  const { data: newContract, error: contractError } = await q.insert({
    unit_id:          parsed.data.unit_id,
    tenant_id:        parsed.data.tenant_id,
    contract_type:    parsed.data.contract_type,
    start_date:       parsed.data.start_date,
    end_date:         parsed.data.end_date,
    monthly_rent,
    security_deposit: parsed.data.security_deposit,
    total_amount:     parsed.data.total_amount,
    payment_count:    parsed.data.payment_count,
    payment_amount:   parsed.data.payment_amount,
    payment_cycle:    'monthly',
    payment_day:      1,
    terms:            parsed.data.terms ?? null,
    status:           'active',
    company_id,
  }).select('id').single()

  if (contractError) {
    return {
      success:     false,
      error:       'حدث خطأ أثناء إنشاء العقد: ' + contractError.message,
      fieldErrors: {},
    }
  }

  const contractId: string = newContract?.id

  // Mark unit as occupied
  await (supabase.from('units') as any)
    .update({ status: 'occupied' })
    .eq('id', parsed.data.unit_id)

  // Auto-create invoices for each scheduled payment
  if (schedule.length > 0 && contractId) {
    const invoicesPayload = schedule.map((item, i) => ({
      contract_id:  contractId,
      tenant_id:    parsed.data.tenant_id,
      unit_id:      parsed.data.unit_id,
      type:         'rent',
      amount:       item.amount,
      tax_amount:   0,
      due_date:     item.due_date,
      status:       'pending',
      notes:        `دفعة ${i + 1} من ${schedule.length}`,
      company_id,
    }))

    const { error: invoicesError } = await (supabase.from('invoices') as any)
      .insert(invoicesPayload)

    if (invoicesError) {
      // Contract created but invoices failed — log and continue
      console.error('[createContract] invoices error:', invoicesError)
    }
  }

  revalidatePath('/dashboard/contracts')
  revalidatePath('/dashboard/invoices')
  revalidatePath('/dashboard/tenants')
  revalidatePath('/dashboard/properties')
  return { success: true, error: null, fieldErrors: {} }
}

// ─── Schema للتجديد (بدون unit_id/tenant_id — مأخوذان من العقد القديم) ─────
const renewSchema = z.object({
  contract_type:    z.enum(['full_time', 'part_time']).default('full_time'),
  start_date:       z.string().min(1, 'تاريخ البداية مطلوب'),
  end_date:         z.string().min(1, 'تاريخ النهاية مطلوب'),
  total_amount:     z.coerce.number().positive('إجمالي الإيجار يجب أن يكون موجباً'),
  payment_count:    z.coerce.number().int().min(1).max(365),
  payment_amount:   z.coerce.number().positive(),
  security_deposit: z.coerce.number().min(0).default(0),
  terms:            z.string().optional().nullable(),
}).refine(
  (d) => new Date(d.end_date) > new Date(d.start_date),
  { message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية', path: ['end_date'] }
)

export type RenewFormState = {
  success:         boolean
  error:           string | null
  fieldErrors:     Record<string, string[]>
  newContractId?:  string
}

export async function renewContract(
  oldContractId: string,
  _prev: RenewFormState,
  formData: FormData
): Promise<RenewFormState> {
  const raw = {
    contract_type:    formData.get('contract_type') || 'full_time',
    start_date:       formData.get('start_date'),
    end_date:         formData.get('end_date'),
    total_amount:     formData.get('total_amount'),
    payment_count:    formData.get('payment_count'),
    payment_amount:   formData.get('payment_amount'),
    security_deposit: formData.get('security_deposit') || '0',
    terms:            formData.get('terms') || null,
  }

  const parsed = renewSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // Parse schedule
  let schedule: z.infer<typeof scheduleItemSchema>[] = []
  const scheduleRaw = formData.get('schedule')
  if (scheduleRaw && typeof scheduleRaw === 'string') {
    try {
      const arr = JSON.parse(scheduleRaw)
      const result = z.array(scheduleItemSchema).safeParse(arr)
      if (result.success) schedule = result.data
    } catch { /* ignore */ }
  }

  const supabase    = await createServerClient()
  const company_id  = await getUserCompanyId()

  // جلب بيانات العقد القديم
  const { data: oldContract } = await (supabase.from('contracts') as any)
    .select('unit_id, tenant_id, status')
    .eq('id', oldContractId)
    .single()

  if (!oldContract) return { success: false, error: 'العقد غير موجود', fieldErrors: {} }

  // تحديث العقد القديم إلى "مجدد"
  const { error: updateError } = await (supabase.from('contracts') as any)
    .update({ status: 'renewed' })
    .eq('id', oldContractId)

  if (updateError) {
    return { success: false, error: 'حدث خطأ أثناء تحديث العقد القديم: ' + updateError.message, fieldErrors: {} }
  }

  // إنشاء العقد الجديد
  const monthly_rent = Math.round((parsed.data.total_amount / 12) * 100) / 100

  const { data: newContract, error: contractError } = await (supabase.from('contracts') as any)
    .insert({
      unit_id:          oldContract.unit_id,
      tenant_id:        oldContract.tenant_id,
      contract_type:    parsed.data.contract_type,
      start_date:       parsed.data.start_date,
      end_date:         parsed.data.end_date,
      monthly_rent,
      security_deposit: parsed.data.security_deposit,
      total_amount:     parsed.data.total_amount,
      payment_count:    parsed.data.payment_count,
      payment_amount:   parsed.data.payment_amount,
      payment_cycle:    'monthly',
      payment_day:      1,
      terms:            parsed.data.terms ?? null,
      status:           'active',
      company_id,
    })
    .select('id')
    .single()

  if (contractError) {
    return { success: false, error: 'حدث خطأ أثناء إنشاء العقد الجديد: ' + contractError.message, fieldErrors: {} }
  }

  const newContractId: string = newContract?.id

  // إنشاء الفواتير
  if (schedule.length > 0 && newContractId) {
    const invoicesPayload = schedule.map((item, i) => ({
      contract_id: newContractId,
      tenant_id:   oldContract.tenant_id,
      unit_id:     oldContract.unit_id,
      type:        'rent',
      amount:      item.amount,
      tax_amount:  0,
      due_date:    item.due_date,
      status:      'pending',
      notes:       `دفعة ${i + 1} من ${schedule.length} (تجديد)`,
      company_id,
    }))
    const { error: invErr } = await (supabase.from('invoices') as any).insert(invoicesPayload)
    if (invErr) console.error('[renewContract] invoices error:', invErr)
  }

  revalidatePath('/dashboard/contracts')
  revalidatePath(`/dashboard/contracts/${oldContractId}`)
  revalidatePath('/dashboard/invoices')
  revalidatePath('/dashboard/tenants')
  return { success: true, error: null, fieldErrors: {}, newContractId }
}

export async function terminateContract(
  contractId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerClient()

  // Get unit_id before terminating
  const { data: contract } = await (supabase.from('contracts') as any)
    .select('unit_id')
    .eq('id', contractId)
    .single()

  const q = supabase.from('contracts') as any
  const { error } = await q.update({ status: 'terminated' }).eq('id', contractId)

  if (error) {
    return { success: false, error: 'حدث خطأ أثناء إنهاء العقد: ' + error.message }
  }

  // Mark unit as available
  if (contract?.unit_id) {
    await (supabase.from('units') as any)
      .update({ status: 'available' })
      .eq('id', contract.unit_id)
  }

  revalidatePath('/dashboard/contracts')
  revalidatePath(`/dashboard/contracts/${contractId}`)
  revalidatePath('/dashboard/properties')
  revalidatePath('/dashboard/invoices')
  return { success: true, error: null }
}
