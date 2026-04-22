import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/middleware'
import type { UserRole } from '@repo/types'

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/accept-invite']
const ONBOARDING_ROUTE = '/onboarding'

/**
 * Routes restricted to specific roles.
 * admin always has full access — these rules apply to other roles.
 */
const ROLE_RESTRICTED: Record<string, UserRole[]> = {
  '/dashboard/properties':      ['admin', 'manager'],
  '/dashboard/tenants':         ['admin', 'manager'],
  '/dashboard/contracts':       ['admin', 'manager'],
  '/dashboard/bookings':        ['admin', 'manager', 'receptionist'],
  '/dashboard/business-center': ['admin', 'manager', 'receptionist'],
  '/dashboard/invoices':        ['admin', 'accountant'],
  '/dashboard/maintenance':     ['admin', 'maintenance'],
  '/dashboard/employees':       ['admin'],
  '/dashboard/settings':        ['admin'],
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request)

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublicRoute = PUBLIC_ROUTES.some(route =>
    route === '/' ? pathname === '/' : pathname.startsWith(route)
  )
  const isOnboarding = pathname.startsWith(ONBOARDING_ROUTE)

  // Unauthenticated → redirect to login (except public & onboarding)
  if (!user && !isPublicRoute && !isOnboarding) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated on public route → redirect to dashboard
  if (user && isPublicRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Authenticated user — check company assignment
  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    // No company → redirect to onboarding (unless already there)
    if (!profile?.company_id && !isOnboarding) {
      return NextResponse.redirect(new URL(ONBOARDING_ROUTE, request.url))
    }

    // Has company but tries to access onboarding → redirect to dashboard
    if (profile?.company_id && isOnboarding) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Role-based protection for dashboard routes
    if (!isOnboarding) {
      const restrictedEntry = Object.entries(ROLE_RESTRICTED).find(([route]) =>
        pathname.startsWith(route)
      )

      if (restrictedEntry) {
        const [, allowedRoles] = restrictedEntry
        const userRole = profile?.role as UserRole | undefined

        if (!userRole || !allowedRoles.includes(userRole)) {
          const url = new URL('/dashboard', request.url)
          url.searchParams.set('error', 'access_denied')
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
