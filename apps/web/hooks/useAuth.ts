'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@repo/types'
import { createClient } from '@/lib/supabase/client'

interface AuthState {
  user: User | null
  role: UserRole | null
  loading: boolean
}

export function useAuth() {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
  })

  useEffect(() => {
    const supabase = createClient()

    async function fetchRole(userId: string): Promise<UserRole | null> {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      return (data?.role as UserRole) ?? null
    }

    // Load initial session
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const role = await fetchRole(user.id)
        setState({ user, role, loading: false })
      } else {
        setState({ user: null, role: null, loading: false })
      }
    })

    // Listen for auth state changes (sign-in / sign-out / token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const role = await fetchRole(session.user.id)
        setState({ user: session.user, role, loading: false })
      } else {
        setState({ user: null, role: null, loading: false })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [router])

  return { ...state, signOut }
}
