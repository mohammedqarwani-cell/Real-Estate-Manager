'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

// ─── Schemas ────────────────────────────────────────────────

const createMaintenanceSchema = z.object({
  unit_id:     z.string().uuid('يرجى اختيار الوحدة'),
  title:       z.string().min(3, 'العنوان مطلوب (3 أحرف على الأقل)'),
  category:    z.enum(['plumbing', 'electrical', 'hvac', 'structural', 'cleaning', 'other']),
  description: z.string().min(5, 'يرجى كتابة وصف للمشكلة'),
  priority:    z.enum(['low', 'medium', 'high', 'urgent']),
})

const updateStatusSchema = z.object({
  status:      z.enum(['open', 'in_progress', 'completed', 'cancelled']),
  assigned_to: z.string().uuid().optional().nullable(),
  actual_cost: z.coerce.number().min(0).optional().nullable(),
  notes:       z.string().optional().nullable(),
})

// ─── Types ──────────────────────────────────────────────────

export type MaintenanceFormState = {
  success: boolean
  error: string | null
  fieldErrors: Record<string, string[]>
}

// ─── Actions ────────────────────────────────────────────────

export async function createMaintenanceRequest(
  _prev: MaintenanceFormState,
  formData: FormData
): Promise<MaintenanceFormState> {
  const raw = {
    unit_id:     formData.get('unit_id'),
    title:       formData.get('title'),
    category:    formData.get('category'),
    description: formData.get('description'),
    priority:    formData.get('priority'),
  }

  const parsed = createMaintenanceSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // ── Upload images (optional) ──────────────────────────────
  const imageFiles = formData.getAll('images') as File[]
  const imageUrls: string[] = []

  const hasImages = imageFiles.some((f) => f.size > 0)
  if (hasImages) {
    const storageClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    for (const file of imageFiles) {
      if (file.size === 0) continue
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `maintenance/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())
      const { error: uploadError } = await storageClient.storage
        .from('property-images')
        .upload(path, buffer, { contentType: file.type })
      if (!uploadError) {
        const { data: { publicUrl } } = storageClient.storage
          .from('property-images')
          .getPublicUrl(path)
        imageUrls.push(publicUrl)
      }
    }
  }

  const supabase = await createServerClient()
  const q = supabase.from('maintenance_requests') as any
  const { error } = await q.insert({
    unit_id:     parsed.data.unit_id,
    title:       parsed.data.title,
    category:    parsed.data.category,
    description: parsed.data.description,
    priority:    parsed.data.priority,
    status:      'open',
    images:      imageUrls,
  })

  if (error) {
    return { success: false, error: 'حدث خطأ أثناء إنشاء الطلب: ' + error.message, fieldErrors: {} }
  }

  revalidatePath('/dashboard/maintenance')
  return { success: true, error: null, fieldErrors: {} }
}

export async function updateMaintenanceRequest(
  id: string,
  data: {
    status:      string
    assigned_to: string | null
    actual_cost: number | null
    notes:       string | null
  }
): Promise<{ success: boolean; error: string | null }> {
  const parsed = updateStatusSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'بيانات غير صحيحة' }
  }

  const supabase = await createServerClient()
  const q = supabase.from('maintenance_requests') as any
  const { error } = await q.update({
    status:      parsed.data.status,
    assigned_to: parsed.data.assigned_to ?? null,
    actual_cost: parsed.data.actual_cost ?? null,
    notes:       parsed.data.notes ?? null,
  }).eq('id', id)

  if (error) {
    return { success: false, error: 'حدث خطأ: ' + error.message }
  }

  revalidatePath('/dashboard/maintenance')
  return { success: true, error: null }
}
