'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

function getStorageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const tenantSchema = z.object({
  full_name: z.string().min(1, 'الاسم الكامل مطلوب'),
  email: z.string().email('بريد إلكتروني غير صالح').optional().nullable(),
  phone: z.string().optional().nullable(),
  national_id: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'blacklisted']).default('active'),
})

export type TenantFormState = {
  success: boolean
  error: string | null
  fieldErrors: Record<string, string[]>
}

async function uploadDocument(file: File): Promise<string | null> {
  const supabase = getStorageClient()
  const ext = file.name.split('.').pop()
  const path = `tenants/documents/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage
    .from('property-images')
    .upload(path, file, { upsert: false })
  if (error) { console.error('Document upload error:', error.message); return null }
  const { data } = supabase.storage.from('property-images').getPublicUrl(path)
  return data.publicUrl
}

export async function createTenant(
  _prev: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  const raw = {
    full_name: formData.get('full_name'),
    email: formData.get('email') || null,
    phone: formData.get('phone') || null,
    national_id: formData.get('national_id') || null,
    company_name: formData.get('company_name') || null,
    address: formData.get('address') || null,
    notes: formData.get('notes') || null,
    status: formData.get('status') || 'active',
  }

  const parsed = tenantSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const docFiles = formData.getAll('documents') as File[]
  const documents: string[] = []
  for (const file of docFiles) {
    if (file.size > 0) {
      const url = await uploadDocument(file)
      if (url) documents.push(url)
    }
  }

  const supabase = await createServerClient()
  const q = supabase.from('tenants') as any
  const { error } = await q.insert({
    full_name: parsed.data.full_name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    national_id: parsed.data.national_id ?? null,
    company_name: parsed.data.company_name ?? null,
    address: parsed.data.address ?? null,
    notes: parsed.data.notes ?? null,
    status: parsed.data.status,
    documents,
  })

  if (error) {
    return { success: false, error: 'حدث خطأ أثناء إضافة المستأجر: ' + error.message, fieldErrors: {} }
  }

  revalidatePath('/dashboard/tenants')
  return { success: true, error: null, fieldErrors: {} }
}

export async function updateTenant(
  tenantId: string,
  _prev: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  const raw = {
    full_name: formData.get('full_name'),
    email: formData.get('email') || null,
    phone: formData.get('phone') || null,
    national_id: formData.get('national_id') || null,
    company_name: formData.get('company_name') || null,
    address: formData.get('address') || null,
    notes: formData.get('notes') || null,
    status: formData.get('status') || 'active',
  }

  const parsed = tenantSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createServerClient()
  const existing = await (supabase.from('tenants') as any)
    .select('documents')
    .eq('id', tenantId)
    .single()
  let documents: string[] = existing?.data?.documents ?? []

  const docFiles = formData.getAll('documents') as File[]
  for (const file of docFiles) {
    if (file.size > 0) {
      const url = await uploadDocument(file)
      if (url) documents = [url, ...documents]
    }
  }

  const q = supabase.from('tenants') as any
  const { error } = await q
    .update({
      full_name: parsed.data.full_name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      national_id: parsed.data.national_id ?? null,
      company_name: parsed.data.company_name ?? null,
      address: parsed.data.address ?? null,
      notes: parsed.data.notes ?? null,
      status: parsed.data.status,
      documents,
    })
    .eq('id', tenantId)

  if (error) {
    return { success: false, error: 'حدث خطأ أثناء تحديث المستأجر: ' + error.message, fieldErrors: {} }
  }

  revalidatePath('/dashboard/tenants')
  revalidatePath('/dashboard/contracts')
  return { success: true, error: null, fieldErrors: {} }
}

export async function deleteTenant(
  tenantId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerClient()
  const { error } = await supabase.from('tenants').delete().eq('id', tenantId)
  if (error) {
    return { success: false, error: 'حدث خطأ أثناء حذف المستأجر: ' + error.message }
  }
  revalidatePath('/dashboard/tenants')
  return { success: true, error: null }
}
