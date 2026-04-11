import { createServerClient } from '@/lib/supabase/server'
import { TenantsClient, type TenantWithContractCount } from '@/components/tenants/TenantsClient'

export const metadata = { title: 'المستأجرون' }

export default async function TenantsPage() {
  const supabase = await createServerClient()

  const [tenantsResult, contractsResult] = await Promise.all([
    (supabase.from('tenants') as any).select('*').order('created_at', { ascending: false }),
    (supabase.from('contracts') as any).select('tenant_id').eq('status', 'active'),
  ])

  if (tenantsResult.error) {
    console.error('[TenantsPage] tenants error:', tenantsResult.error)
  }
  if (contractsResult.error) {
    console.error('[TenantsPage] contracts error:', contractsResult.error)
  }

  const tenants = tenantsResult.data ?? []
  const contracts = contractsResult.data ?? []

  const contractCountMap: Record<string, number> = {}
  for (const c of contracts) {
    const id = c.tenant_id
    if (id) contractCountMap[id] = (contractCountMap[id] ?? 0) + 1
  }

  const tenantsWithCount: TenantWithContractCount[] = tenants.map((t: any) => ({
    ...t,
    active_contracts: contractCountMap[t.id] ?? 0,
  }))

  return (
    <div dir="rtl">
      <TenantsClient tenants={tenantsWithCount} />
    </div>
  )
}
