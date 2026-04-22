'use server'

import { createServerClient } from './server'

/**
 * Returns the company_id for the currently authenticated user.
 * Used by Server Actions to scope INSERT operations to the correct company.
 */
export async function getUserCompanyId(): Promise<string | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  return profile?.company_id ?? null
}
