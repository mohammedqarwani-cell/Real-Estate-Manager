import { createServerClient } from '@/lib/supabase/server'
import { redirect }          from 'next/navigation'
import { EmployeesClient }   from '@/components/employees/EmployeesClient'
import type { Employee }     from '@repo/types'

export const metadata = { title: 'الموظفون' }

export default async function EmployeesPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if ((profile as any)?.role !== 'admin') redirect('/dashboard')

  const companyId = (profile as any)?.company_id as string | null
  if (!companyId) redirect('/onboarding')

  const { data: employees } = await (supabase.from('employees') as any)
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الموظفون</h1>
        <p className="text-muted-foreground text-sm mt-1">
          إدارة فريق العمل وصلاحياتهم
        </p>
      </div>
      <EmployeesClient
        employees={(employees ?? []) as Employee[]}
        companyId={companyId}
      />
    </div>
  )
}
