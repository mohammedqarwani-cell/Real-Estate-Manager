import { createServerClient } from '@/lib/supabase/server'
import { ContractsClient, type ContractWithRelations } from '@/components/contracts/ContractsClient'
import type { Tenant, Unit, Property } from '@repo/types'

export const metadata = { title: 'العقود' }

export default async function ContractsPage() {
  const supabase = await createServerClient()

  const [{ data: contracts }, { data: units }, { data: tenants }, { data: properties }] =
    await Promise.all([
      supabase
        .from('contracts')
        .select(`*, tenant:tenants(id, full_name, company_name, phone), unit:units(id, unit_number, property:properties(id, name))`)
        .order('created_at', { ascending: false }),
      (supabase.from('units') as any)
        .select('id, unit_number, monthly_rent, status, property:properties(id, name)')
        .eq('status', 'available'),
      supabase.from('tenants').select('*').eq('status', 'active').order('full_name'),
      supabase.from('properties').select('id, name').order('name'),
    ])

  return (
    <div dir="rtl">
      <ContractsClient
        contracts={(contracts ?? []) as unknown as ContractWithRelations[]}
        availableUnits={(units ?? []) as unknown as (Unit & { property: Pick<Property, 'id' | 'name'> })[]}
        tenants={(tenants ?? []) as unknown as Tenant[]}
        properties={(properties ?? []) as Pick<Property, 'id' | 'name'>[]}
      />
    </div>
  )
}
