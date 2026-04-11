'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

const contractSchema = z.object({
  unit_id: z.string().uuid('يرجى اختيار وحدة'),
  tenant_id: z.string().uuid('يرجى اختيار مستأجر'),
  start_date: z.string().min(1, 'تاريخ البداية مطلوب'),
  end_date: z.string().min(1, 'تاريخ النهاية مطلوب'),
  monthly_rent: z.coerce.number().positive('قيمة الإيجار يجب أن تكون موجبة'),
  security_deposit: z.coerce.number().min(0).default(0),
  payment_day: z.coerce.number().int().min(1).max(31).default(1),
  payment_cycle: z.enum(['monthly', 'quarterly', 'annually']).default('monthly'),
  terms: z.string().optional().nullable(),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية', path: ['end_date'] }
)

export type ContractFormState = {
  success: boolean
  error: string | null
  fieldErrors: Record<string, string[]>
}

export async function createContract(
  _prev: ContractFormState,
  formData: FormData
): Promise<ContractFormState> {
  const raw = {
    unit_id: formData.get('unit_id'),
    tenant_id: formData.get('tenant_id'),
    start_date: formData.get('start_date'),
    end_date: formData.get('end_date'),
    monthly_rent: formData.get('monthly_rent'),
    security_deposit: formData.get('security_deposit') || '0',
    payment_day: formData.get('payment_day') || '1',
    payment_cycle: formData.get('payment_cycle') || 'monthly',
    terms: formData.get('terms') || null,
  }

  const parsed = contractSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createServerClient()

  const { data: unit } = await (supabase.from('units') as any)
    .select('status, unit_number')
    .eq('id', parsed.data.unit_id)
    .single()

  if (unit?.status === 'occupied') {
    return {
      success: false,
      error: `الوحدة ${unit?.unit_number} مؤجرة حالياً، يرجى اختيار وحدة أخرى`,
      fieldErrors: {},
    }
  }

  const q = supabase.from('contracts') as any
  const { error } = await q.insert({
    unit_id: parsed.data.unit_id,
    tenant_id: parsed.data.tenant_id,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    monthly_rent: parsed.data.monthly_rent,
    security_deposit: parsed.data.security_deposit,
    payment_day: parsed.data.payment_day,
    payment_cycle: parsed.data.payment_cycle,
    terms: parsed.data.terms ?? null,
    status: 'active',
  })

  if (error) {
    return { success: false, error: 'حدث خطأ أثناء إنشاء العقد: ' + error.message, fieldErrors: {} }
  }

  revalidatePath('/dashboard/contracts')
  revalidatePath('/dashboard/tenants')
  revalidatePath('/dashboard/properties')
  return { success: true, error: null, fieldErrors: {} }
}

export async function terminateContract(
  contractId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerClient()

  const q = supabase.from('contracts') as any
  const { error } = await q.update({ status: 'terminated' }).eq('id', contractId)

  if (error) {
    return { success: false, error: 'حدث خطأ أثناء إنهاء العقد: ' + error.message }
  }

  revalidatePath('/dashboard/contracts')
  revalidatePath(`/dashboard/contracts/${contractId}`)
  revalidatePath('/dashboard/properties')
  return { success: true, error: null }
}
