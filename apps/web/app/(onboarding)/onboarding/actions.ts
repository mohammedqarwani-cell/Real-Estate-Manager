'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

const companySchema = z.object({
  name: z.string().min(2, 'اسم الشركة يجب أن يكون حرفين على الأقل'),
  slug: z
    .string()
    .min(2, 'المعرّف يجب أن يكون حرفين على الأقل')
    .max(50, 'المعرّف يجب ألا يتجاوز 50 حرفاً')
    .regex(/^[a-z0-9-]+$/, 'المعرّف يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطة فقط'),
  plan: z.enum(['free', 'pro']).default('free'),
})

export type OnboardingFormState = {
  success: boolean
  error: string | null
  fieldErrors: Record<string, string[]>
}

export async function createCompany(
  _prev: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'يجب تسجيل الدخول أولاً', fieldErrors: {} }
  }

  const raw = {
    name: formData.get('name'),
    slug: formData.get('slug'),
    plan: formData.get('plan') || 'free',
  }

  const parsed = companySchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { name, slug, plan } = parsed.data

  // Check slug uniqueness — bypass RLS with service role to read all companies
  const { createClient } = await import('@supabase/supabase-js')
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existing } = await adminClient
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return {
      success: false,
      error: null,
      fieldErrors: { slug: ['هذا المعرّف مستخدم بالفعل، يرجى اختيار معرّف آخر'] },
    }
  }

  // Plan config
  const planConfig = plan === 'pro'
    ? { max_properties: null, max_units: null, max_users: null }
    : { max_properties: 3, max_units: 20, max_users: 2 }

  // Generate company ID upfront to avoid SELECT-after-INSERT RLS issue:
  // companies_select uses id = get_user_company_id() which is NULL for new users,
  // so the returned row would be empty even after a successful INSERT.
  const companyId = crypto.randomUUID()

  const { error: companyError } = await adminClient
    .from('companies')
    .insert({
      id: companyId,
      name,
      slug,
      owner_id: user.id,
      subscription_plan: plan,
      subscription_status: plan === 'pro' ? 'trialing' : 'active',
      trial_ends_at: plan === 'pro'
        ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      ...planConfig,
    } as any)

  if (companyError) {
    return { success: false, error: 'حدث خطأ أثناء إنشاء الشركة', fieldErrors: {} }
  }

  // Upsert profile: يضمن وجود الـ row حتى لو trigger لم يُنشئه
  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: user.id,
      full_name: (user.user_metadata?.full_name as string) ?? '',
      company_id: companyId,
      role: 'admin',
    } as any, { onConflict: 'id' })

  if (profileError) {
    return { success: false, error: `خطأ في الملف الشخصي: ${profileError.message}`, fieldErrors: {} }
  }

  // تحقق أن company_id وصل فعلاً قبل الـ redirect
  const { data: verifyProfile } = await adminClient
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!verifyProfile?.company_id) {
    return { success: false, error: 'تعذّر ربط الحساب بالشركة، يرجى المحاولة مجدداً', fieldErrors: {} }
  }

  redirect('/dashboard')
}
