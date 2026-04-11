import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { UnitsClient } from '@/components/units/UnitsClient'
import type { Unit, Contract, MaintenanceRequest, Tenant } from '@repo/types'

export const metadata = { title: 'إدارة الوحدات' }

type ContractWithTenant = Contract & {
  tenant: Pick<Tenant, 'id' | 'full_name' | 'email' | 'phone'> | null
}

export default async function UnitsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: propertyId } = await params
  const supabase = await createServerClient()

  // 1. Fetch property + units in parallel
  const [{ data: propertyRaw }, { data: units }] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name')
      .eq('id', propertyId)
      .single(),
    supabase
      .from('units')
      .select('*')
      .eq('property_id', propertyId)
      .order('unit_number', { ascending: true }),
  ])

  if (!propertyRaw) notFound()
  const property = propertyRaw as { id: string; name: string }

  const typedUnits = (units ?? []) as Unit[]
  const unitIds = typedUnits.map((u) => u.id)

  // 2. Fetch contracts + maintenance only if there are units
  let typedContracts: ContractWithTenant[] = []
  let typedMaintenance: MaintenanceRequest[] = []

  if (unitIds.length > 0) {
    const [{ data: contracts }, { data: maintenance }] = await Promise.all([
      supabase
        .from('contracts')
        .select('*, tenant:tenants(id, full_name, email, phone)')
        .in('unit_id', unitIds)
        .order('start_date', { ascending: false }),
      supabase
        .from('maintenance_requests')
        .select('*')
        .in('unit_id', unitIds)
        .order('created_at', { ascending: false }),
    ])
    typedContracts = (contracts ?? []) as ContractWithTenant[]
    typedMaintenance = (maintenance ?? []) as MaintenanceRequest[]
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard/properties" className="hover:text-foreground transition-colors">
          العقارات
        </Link>
        <ChevronRight className="h-4 w-4 rotate-180" />
        <Link
          href={`/dashboard/properties/${propertyId}`}
          className="hover:text-foreground transition-colors max-w-[160px] truncate"
        >
          {property.name}
        </Link>
        <ChevronRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground font-medium">الوحدات</span>
      </nav>

      <UnitsClient
        propertyId={propertyId}
        propertyName={property.name}
        units={typedUnits}
        contracts={typedContracts}
        maintenanceRequests={typedMaintenance}
      />
    </div>
  )
}
