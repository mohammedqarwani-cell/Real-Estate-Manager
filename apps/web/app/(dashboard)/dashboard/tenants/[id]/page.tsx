import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { TenantDetailClient } from '@/components/tenants/TenantDetailClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data } = await (supabase.from('tenants') as any).select('full_name, company_name').eq('id', id).single()
  return { title: data?.company_name || data?.full_name || 'تفاصيل المستأجر' }
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const [tenantRes, contractsRes, invoicesRes] = await Promise.all([
    (supabase.from('tenants') as any).select('*').eq('id', id).single(),

    (supabase.from('contracts') as any)
      .select(`
        id, status, start_date, end_date, monthly_rent, payment_cycle,
        total_amount, payment_amount, payment_count, created_at,
        unit:units(id, unit_number, floor, type, property:properties(id, name))
      `)
      .eq('tenant_id', id)
      .order('created_at', { ascending: false }),

    (supabase.from('invoices') as any)
      .select('id, invoice_number, type, total_amount, status, due_date, created_at')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (!tenantRes.data) notFound()

  return (
    <div dir="rtl">
      <TenantDetailClient
        tenant={tenantRes.data}
        contracts={contractsRes.data ?? []}
        invoices={invoicesRes.data ?? []}
      />
    </div>
  )
}
