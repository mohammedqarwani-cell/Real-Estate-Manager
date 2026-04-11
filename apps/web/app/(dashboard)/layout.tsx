import { redirect } from 'next/navigation'
import { addDays } from 'date-fns'
import { createServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import type { UserRole } from '@repo/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const threshold = addDays(new Date(), 30).toISOString().split('T')[0]

  const [{ data: profile }, { count: expiringCount }, { count: overdueInvoicesCount }, { count: openMaintenanceCount }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .lte('end_date', threshold),
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'overdue'),
    supabase
      .from('maintenance_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
  ])

  const role = (profile?.role ?? null) as UserRole | null

  return (
    <div className="flex h-screen overflow-hidden bg-muted/10">
      <Sidebar
        role={role}
        expiringContractsCount={expiringCount ?? 0}
        overdueInvoicesCount={overdueInvoicesCount ?? 0}
        openMaintenanceCount={openMaintenanceCount ?? 0}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header user={profile} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
