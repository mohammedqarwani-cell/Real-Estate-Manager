'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@repo/types'
import { createClient } from '@/lib/supabase/client'

interface AuthState {
  user: User | null
  role: UserRole | null
  companyId: string | null
  loading: boolean
}

export function useAuth() {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    companyId: null,
    loading: true,
  })

  useEffect(() => {
    const supabase = createClient()

    async function fetchProfile(userId: string): Promise<{ role: UserRole | null; companyId: string | null }> {
      const { data } = await supabase
        .from('profiles')
        .select('role, company_id')
        .eq('id', userId)
        .single()
      return {
        role: ((data as any)?.role as UserRole) ?? null,
        companyId: (data as any)?.company_id ?? null,
      }
    }

    // Load initial session — getSession() reads from localStorage (no network lock)
    // The middleware already validates the session server-side, so this is safe client-side
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { role, companyId } = await fetchProfile(session.user.id)
        setState({ user: session.user, role, companyId, loading: false })
      } else {
        setState({ user: null, role: null, companyId: null, loading: false })
      }
    })

    // Listen for auth state changes (sign-in / sign-out / token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { role, companyId } = await fetchProfile(session.user.id)
        setState({ user: session.user, role, companyId, loading: false })
      } else {
        setState({ user: null, role: null, companyId: null, loading: false })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }, [])

  return { ...state, signOut }
}
