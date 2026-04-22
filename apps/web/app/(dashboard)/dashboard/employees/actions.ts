'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { UserRole } from '@repo/types'

const ROLE_LABELS: Record<string, string> = {
  manager:      'مدير',
  accountant:   'محاسب',
  maintenance:  'فني صيانة',
  receptionist: 'موظف استقبال',
}

const inviteSchema = z.object({
  email: z.string().email('بريد إلكتروني غير صحيح'),
  name:  z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  phone: z.string().optional(),
  role:  z.enum(['manager', 'accountant', 'maintenance', 'receptionist']),
})

export type InviteFormState = {
  success: boolean
  error: string | null
  fieldErrors: Record<string, string[]>
  inviteUrl?: string
}

export async function inviteEmployee(
  _prev: InviteFormState,
  formData: FormData
): Promise<InviteFormState> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'غير مصرح', fieldErrors: {} }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if ((profile as any)?.role !== 'admin') {
    return { success: false, error: 'صلاحيات غير كافية', fieldErrors: {} }
  }

  const companyId = (profile as any)?.company_id as string
  if (!companyId) return { success: false, error: 'لم يتم تحديد الشركة', fieldErrors: {} }

  const raw = {
    email: formData.get('email'),
    name:  formData.get('name'),
    phone: formData.get('phone') || undefined,
    role:  formData.get('role'),
  }

  const parsed = inviteSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'يرجى تصحيح الأخطاء',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { email, name, phone, role } = parsed.data

  const { createClient } = await import('@supabase/supabase-js')
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check if employee already exists in this company
  const { data: existing } = await adminClient
    .from('employees')
    .select('id')
    .eq('company_id', companyId)
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return {
      success: false,
      error: null,
      fieldErrors: { email: ['هذا البريد الإلكتروني مدعو بالفعل لهذه الشركة'] },
    }
  }

  // Create employee record (user_id null until invite accepted)
  const { data: employee, error: empError } = await adminClient
    .from('employees')
    .insert({
      company_id:  companyId,
      user_id:     null,
      name,
      email,
      phone:       phone ?? null,
      role,
      status:      'active',
      invited_by:  user.id,
    } as any)
    .select('id')
    .single()

  if (empError || !employee) {
    return { success: false, error: 'حدث خطأ أثناء إنشاء سجل الموظف', fieldErrors: {} }
  }

  // Create invitation record
  const { data: invitation, error: invError } = await adminClient
    .from('employee_invitations')
    .insert({
      company_id:  companyId,
      employee_id: employee.id,
      email,
      role,
      invited_by:  user.id,
    } as any)
    .select('token')
    .single()

  if (invError || !invitation) {
    // Rollback employee on invitation failure
    await adminClient.from('employees').delete().eq('id', employee.id)
    return { success: false, error: 'حدث خطأ أثناء إنشاء رابط الدعوة', fieldErrors: {} }
  }

  // Fetch company name for email
  const { data: company } = await adminClient
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .single()

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '') ?? ''
  const inviteUrl = `${appUrl}/accept-invite?token=${invitation.token}`
  const roleLabel = ROLE_LABELS[role] ?? role

  // Send invitation email via Resend
  try {
    await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    process.env.FROM_EMAIL ?? 'onboarding@resend.dev',
        to:      email,
        subject: `دعوة للانضمام إلى ${company?.name ?? 'فريق العمل'}`,
        html: `
<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">مرحباً ${name}،</h2>
  <p>تمت دعوتك للانضمام إلى <strong>${company?.name ?? 'فريق العمل'}</strong> بصفة <strong>${roleLabel}</strong>.</p>
  <p>انقر على الزر أدناه لإنشاء حسابك والبدء:</p>
  <a href="${inviteUrl}"
     style="display:inline-block; background:#2563eb; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; margin: 16px 0;">
    قبول الدعوة وإنشاء الحساب
  </a>
  <p style="color:#666; font-size:13px;">الرابط صالح لمدة 7 أيام. إذا لم تطلب هذه الدعوة، يمكنك تجاهل هذا البريد.</p>
  <p style="color:#aaa; font-size:12px;">أو انسخ هذا الرابط: ${inviteUrl}</p>
</div>`,
      }),
    })
  } catch {
    // Email failure is non-fatal — log and continue
    console.error('[inviteEmployee] Resend error for', email)
  }

  revalidatePath('/dashboard/employees')
  return { success: true, error: null, fieldErrors: {}, inviteUrl }
}

// ─────────────────────────────────────────────
export async function updateEmployeeRole(employeeId: string, role: UserRole) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'غير مصرح' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if ((profile as any)?.role !== 'admin') return { error: 'صلاحيات غير كافية' }

  const companyId = (profile as any)?.company_id as string

  // Update employee record
  const { data: employee, error: empError } = await (supabase.from('employees') as any)
    .update({ role })
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .select('user_id')
    .single()

  if (empError) return { error: 'حدث خطأ أثناء تحديث الدور' }

  // Sync profile role if employee has joined
  const userId = (employee as any)?.user_id
  if (userId) {
    const { createClient } = await import('@supabase/supabase-js')
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await adminClient
      .from('profiles')
      .update({ role } as any)
      .eq('id', userId)
  }

  revalidatePath('/dashboard/employees')
  return { error: null }
}

// ─────────────────────────────────────────────
export async function toggleEmployeeStatus(employeeId: string, currentStatus: string) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'غير مصرح' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if ((profile as any)?.role !== 'admin') return { error: 'صلاحيات غير كافية' }

  const companyId = (profile as any)?.company_id as string
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

  const { error } = await (supabase.from('employees') as any)
    .update({ status: newStatus })
    .eq('id', employeeId)
    .eq('company_id', companyId)

  if (error) return { error: 'حدث خطأ أثناء تحديث الحالة' }

  revalidatePath('/dashboard/employees')
  return { error: null }
}
