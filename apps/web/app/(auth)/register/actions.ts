'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

const registerSchema = z.object({
  fullName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  plan: z.enum(['free', 'pro']).default('free'),
})

export type RegisterState = {
  error: string | null
  fieldErrors: Record<string, string[]>
  emailConfirmationRequired?: boolean
}

export async function registerAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const raw = {
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    plan: formData.get('plan') || 'free',
  }

  const parsed = registerSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      error: 'يرجى تصحيح الأخطاء في النموذج',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { fullName, email, password, plan } = parsed.data

  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) {
    const msg =
      error.message === 'User already registered'
        ? 'هذا البريد الإلكتروني مسجّل بالفعل. يمكنك تسجيل الدخول.'
        : error.message
    return { error: msg, fieldErrors: {} }
  }

  // إذا لم تُنشأ session، يعني Supabase يشترط تأكيد البريد الإلكتروني أولاً
  if (!data.session) {
    return {
      error: null,
      fieldErrors: {},
      emailConfirmationRequired: true,
    }
  }

  // session موجودة → توجّه مباشرة للـ onboarding
  redirect(`/onboarding?plan=${plan}`)
}
