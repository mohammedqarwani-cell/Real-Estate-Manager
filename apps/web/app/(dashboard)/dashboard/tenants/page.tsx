import { createServerClient } from '@/lib/supabase/server'
import { TenantsClient, type TenantWithContractCount } from '@/components/tenants/TenantsClient'

export const metadata = { title: 'المستأجرون' }

export default async function TenantsPage() {
  const supabase = await createServerClient()

  const [tenantsResult, contractsResult] = await Promise.all([
    (supabase.from('tenants') as any).select('*').order('created_at', { ascending: false }),
    (supabase.from('contracts') as any).select('tenant_id, contract_type').eq('status', 'active'),
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
  const contractTypeMap: Record<string, string> = {}
  for (const c of contracts) {
    const id = c.tenant_id
    if (id) {
      contractCountMap[id] = (contractCountMap[id] ?? 0) + 1
      // أحدث نوع العقد الفعّال (يُعاد تعيينه لكل عقد — آخر قيمة تسود)
      if (c.contract_type) contractTypeMap[id] = c.contract_type
    }
  }

  const tenantsWithCount: TenantWithContractCount[] = tenants.map((t: any) => ({
    ...t,
    active_contracts:      contractCountMap[t.id] ?? 0,
    active_contract_type:  contractTypeMap[t.id] ?? null,
  }))

  return (
    <div dir="rtl">
      <TenantsClient tenants={tenantsWithCount} />
    </div>
  )
}
