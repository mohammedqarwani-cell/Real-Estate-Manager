'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { getUserCompanyId } from '@/lib/supabase/company'

function getStorageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Zod Schema ────────────────────────────────────────────────────────────

const propertySchema = z.object({
  name: z.string().min(2, 'اسم العقار يجب أن يكون حرفين على الأقل'),
  type: z.enum(['residential', 'commercial', 'business_center', 'mixed'], {
    required_error: 'نوع العقار مطلوب',
  }),
  address: z.string().min(5, 'العنوان يجب أن يكون 5 أحرف على الأقل'),
  city: z.string().optional(),
  country: z.string().min(2, 'الدولة مطلوبة').default('المملكة العربية السعودية'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'under_maintenance']).default('active'),
})

export type PropertyFormState = {
  success: boolean
  error: string | null
  fieldErrors: Record<string, string[]>
}

// ─── Upload Image to Supabase Storage ──────────────────────────────────────

async function uploadPropertyImage(file: File): Promise<string | null> {
  const supabase = getStorageClient()
  const ext = file.name.split('.').pop()
  const path = `properties/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from('property-images')
    .upload(path, file, { upsert: false })

  if (error) {
    console.error('Storage upload error:', error.message)
    return null
  }

  const { data } = supabase.storage.from('property-images').getPublicUrl(path)
  return data.publicUrl
}

// ─── Create Property ───────────────────────────────────────────────────────

export async function createProperty(
  _prev: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  const raw = {
    name: formData.get('name'),
    type: formData.get('type'),
    address: formData.get('address'),
    city: formData.get('city') || undefined,
    country: formData.get('country') || 'المملكة العربية السعودية',
    description: formData.get('description') || undefined,
    status: formData.get('status') || 'active',
  }

  const parsed = propertySchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // Handle image upload
  const imageFile = formData.get('image') as File | null
  const images: string[] = []
  if (imageFile && imageFile.size > 0) {
    const url = await uploadPropertyImage(imageFile)
    if (url) images.push(url)
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const company_id = await getUserCompanyId()

  const { error } = await supabase.from('properties').insert({
    ...parsed.data,
    images,
    amenities: [],
    created_by: user?.id ?? null,
    company_id,
  } as any)

  if (error) {
    return { success: false, error: 'حدث خطأ أثناء إضافة العقار', fieldErrors: {} }
  }

  revalidatePath('/dashboard/properties')
  return { success: true, error: null, fieldErrors: {} }
}

// ─── Update Property ───────────────────────────────────────────────────────

export async function updateProperty(
  id: string,
  _prev: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  const raw = {
    name: formData.get('name'),
    type: formData.get('type'),
    address: formData.get('address'),
    city: formData.get('city') || undefined,
    country: formData.get('country') || 'المملكة العربية السعودية',
    description: formData.get('description') || undefined,
    status: formData.get('status') || 'active',
  }

  const parsed = propertySchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createServerClient()

  // Fetch existing images to keep them unless replaced
  const { data: existing } = await supabase
    .from('properties')
    .select('images')
    .eq('id', id)
    .single()

  let images: string[] = existing?.images ?? []

  const imageFile = formData.get('image') as File | null
  if (imageFile && imageFile.size > 0) {
    const url = await uploadPropertyImage(imageFile)
    if (url) images = [url, ...images]
  }

  const { error } = await supabase
    .from('properties')
    .update({ ...parsed.data, images })
    .eq('id', id)

  if (error) {
    return { success: false, error: 'حدث خطأ أثناء تحديث العقار', fieldErrors: {} }
  }

  revalidatePath('/dashboard/properties')
  revalidatePath(`/dashboard/properties/${id}`)
  return { success: true, error: null, fieldErrors: {} }
}

// ─── Delete Property ───────────────────────────────────────────────────────

export async function deleteProperty(id: string): Promise<void> {
  const supabase = await createServerClient()
  await supabase.from('properties').delete().eq('id', id)
  revalidatePath('/dashboard/properties')
  redirect('/dashboard/properties')
}
