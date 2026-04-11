'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import type { UnitStatus } from '@repo/types'

function getStorageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Zod Schema ────────────────────────────────────────────────────────────

const unitSchema = z.object({
  unit_number: z.string().min(1, 'رقم الوحدة مطلوب'),
  floor: z.coerce.number().int().optional().nullable(),
  type: z
    .enum(['apartment', 'office', 'retail', 'studio', 'villa', 'warehouse'])
    .optional()
    .nullable(),
  area: z.coerce.number().positive('المساحة يجب أن تكون موجبة').optional().nullable(),
  monthly_rent: z.coerce
    .number()
    .positive('الإيجار يجب أن يكون موجباً')
    .optional()
    .nullable(),
  notes: z.string().optional().nullable(),
})

export type UnitFormState = {
  success: boolean
  error: string | null
  fieldErrors: Record<string, string[]>
}

// ─── Upload Unit Image ──────────────────────────────────────────────────────

async function uploadUnitImage(file: File): Promise<string | null> {
  const supabase = getStorageClient()
  const ext = file.name.split('.').pop()
  const path = `units/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from('property-images')
    .upload(path, file, { upsert: false })

  if (error) {
    console.error('Unit image upload error:', error.message)
    return null
  }

  const { data } = supabase.storage.from('property-images').getPublicUrl(path)
  return data.publicUrl
}

// ─── Create Unit ───────────────────────────────────────────────────────────

export async function createUnit(
  propertyId: string,
  _prev: UnitFormState,
  formData: FormData
): Promise<UnitFormState> {
  const raw = {
    unit_number: formData.get('unit_number'),
    floor: formData.get('floor') || null,
    type: formData.get('type') || null,
    area: formData.get('area') || null,
    monthly_rent: formData.get('monthly_rent') || null,
    notes: formData.get('notes') || null,
  }

  const parsed = unitSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // Handle multiple images
  const imageFiles = formData.getAll('images') as File[]
  const images: string[] = []
  for (const file of imageFiles) {
    if (file.size > 0) {
      const url = await uploadUnitImage(file)
      if (url) images.push(url)
    }
  }

  const supabase = await createServerClient()

  const { error } = await supabase.from('units').insert({
    property_id: propertyId,
    unit_number: parsed.data.unit_number,
    floor: parsed.data.floor ?? null,
    type: parsed.data.type ?? null,
    area: parsed.data.area ?? null,
    bedrooms: null,
    bathrooms: null,
    monthly_rent: parsed.data.monthly_rent ?? null,
    notes: parsed.data.notes ?? null,
    images,
    amenities: [],
    status: 'available',
  } as any)

  if (error) {
    return { success: false, error: 'حدث خطأ أثناء إضافة الوحدة: ' + error.message, fieldErrors: {} }
  }

  revalidatePath(`/dashboard/properties/${propertyId}`)
  revalidatePath(`/dashboard/properties/${propertyId}/units`)
  return { success: true, error: null, fieldErrors: {} }
}

// ─── Update Unit ───────────────────────────────────────────────────────────

export async function updateUnit(
  unitId: string,
  propertyId: string,
  _prev: UnitFormState,
  formData: FormData
): Promise<UnitFormState> {
  const raw = {
    unit_number: formData.get('unit_number'),
    floor: formData.get('floor') || null,
    type: formData.get('type') || null,
    area: formData.get('area') || null,
    monthly_rent: formData.get('monthly_rent') || null,
    notes: formData.get('notes') || null,
  }

  const parsed = unitSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createServerClient()

  // Keep existing images
  const { data: existing } = await supabase
    .from('units')
    .select('images')
    .eq('id', unitId)
    .single()

  let images: string[] = (existing as any)?.images ?? []

  const imageFiles = formData.getAll('images') as File[]
  for (const file of imageFiles) {
    if (file.size > 0) {
      const url = await uploadUnitImage(file)
      if (url) images = [url, ...images]
    }
  }

  const { error } = await supabase
    .from('units')
    .update({
      unit_number: parsed.data.unit_number,
      floor: parsed.data.floor ?? null,
      type: parsed.data.type ?? null,
      area: parsed.data.area ?? null,
      monthly_rent: parsed.data.monthly_rent ?? null,
      notes: parsed.data.notes ?? null,
      images,
    } as any)
    .eq('id', unitId)

  if (error) {
    return { success: false, error: 'حدث خطأ أثناء تحديث الوحدة: ' + error.message, fieldErrors: {} }
  }

  revalidatePath(`/dashboard/properties/${propertyId}`)
  revalidatePath(`/dashboard/properties/${propertyId}/units`)
  return { success: true, error: null, fieldErrors: {} }
}

// ─── Update Unit Status ────────────────────────────────────────────────────

export async function updateUnitStatus(
  unitId: string,
  propertyId: string,
  status: UnitStatus
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('units')
    .update({ status } as any)
    .eq('id', unitId)

  if (error) {
    return { success: false, error: 'حدث خطأ أثناء تحديث حالة الوحدة' }
  }

  revalidatePath(`/dashboard/properties/${propertyId}/units`)
  revalidatePath(`/dashboard/properties/${propertyId}`)
  return { success: true, error: null }
}
