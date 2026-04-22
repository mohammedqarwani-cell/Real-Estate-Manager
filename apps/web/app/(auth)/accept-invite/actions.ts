'use server'

import { redirect }              from 'next/navigation'
import { createClient }          from '@supabase/supabase-js'
import { z }                     from 'zod'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Called from the Server Component to validate the token before rendering form
export async function getInvitationByToken(token: string) {
  const adminClient = getAdminClient()

  const { data: invitation } = await adminClient
    .from('employee_invitations')
    .select('*, employee:employees(name, role), company:companies(name)')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  return invitation as {
    id: string
    email: string
    role: string
    employee_id: string
    company_id: string
    employee: { name: string; role: string } | null
    company: { name: string } | null
  } | null
}

// ─────────────────────────────────────────────
const acceptSchema = z.object({
  token:    z.string().min(1),
  name:     z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
})

export type AcceptInviteState = {
  success: boolean
  error: string | null
  fieldErrors: Record<string, string[]>
}

export async function acceptInviteAction(
  _prev: AcceptInviteState,
  formData: FormData
): Promise<AcceptInviteState> {
  const raw = {
    token:    formData.get('token'),
    name:     formData.get('name'),
    password: formData.get('password'),
  }

  const parsed = acceptSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: null,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { token, name, password } = parsed.data
  const adminClient = getAdminClient()

  // Re-validate token
  const { data: invitation } = await adminClient
    .from('employee_invitations')
    .select('id, email, role, company_id, employee_id')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!invitation) {
    return { success: false, error: 'رابط الدعوة غير صالح أو منتهي الصلاحية', fieldErrors: {} }
  }

  const { email, role, company_id, employee_id } = invitation as {
    id: string; email: string; role: string; company_id: string; employee_id: string
  }

  // Create Supabase auth user
  const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (createError) {
    if (createError.message?.toLowerCase().includes('already')) {
      return {
        success: false,
        error: 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول بحسابك الحالي.',
        fieldErrors: {},
      }
    }
    return { success: false, error: 'حدث خطأ أثناء إنشاء الحساب', fieldErrors: {} }
  }

  const userId = authData.user.id

  // Upsert profile with company + role
  await adminClient
    .from('profiles')
    .upsert({
      id:         userId,
      full_name:  name,
      company_id,
      role,
    } as any, { onConflict: 'id' })

  // Link employee record
  await adminClient
    .from('employees')
    .update({ user_id: userId, joined_at: new Date().toISOString() } as any)
    .eq('id', employee_id)

  // Mark invitation as accepted
  await adminClient
    .from('employee_invitations')
    .update({ accepted_at: new Date().toISOString() } as any)
    .eq('id', (invitation as any).id)

  redirect('/login?message=account_created')
}
