import { createServerClient } from '@/lib/supabase/server'
import { PropertiesClient } from '@/components/properties/PropertiesClient'
import type { Property } from '@repo/types'

export const metadata = { title: 'العقارات' }

export default async function PropertiesPage() {
  const supabase = await createServerClient()

  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false })

  return <PropertiesClient properties={(properties as Property[]) ?? []} />
}
