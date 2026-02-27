import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes and which user types are allowed to access them
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  // Pet owner routes
  '/dashboard': ['pet-owner'],
  '/my-pets': ['pet-owner'],
  '/my-appointments': ['pet-owner'],
  '/vaccine-cards': ['pet-owner'],
  '/patient-records': ['pet-owner', 'veterinarian'],
  '/onboarding/pet': ['pet-owner'],

  // Veterinarian routes
  '/vet-dashboard': ['veterinarian'],
  '/vet-appointments': ['veterinarian'],
  '/schedule': ['veterinarian'],
  '/onboarding/vet': ['veterinarian'],
  '/vet-dashboard/vaccinations': ['veterinarian'],
  '/vet-dashboard/medical-records': ['veterinarian'],
  '/vet-dashboard/appointments': ['veterinarian'],

  // Clinic admin / branch admin routes
  '/clinic-admin': ['clinic-admin', 'branch-admin'],
  '/clinic-admin/vaccinations': ['clinic-admin', 'branch-admin'],
  '/clinic-admin/medical-records': ['clinic-admin', 'branch-admin'],

  // Any authenticated user
  '/billing': ['pet-owner', 'veterinarian', 'clinic-admin', 'branch-admin'],
  '/product-man': ['pet-owner', 'veterinarian', 'clinic-admin', 'branch-admin'],
}

// Pages that redirect already-logged-in users away (so you can't visit /login while logged in)
const AUTH_ONLY_ROUTES = ['/login', '/signup', '/clinic-login']

function getDashboardForUserType(userType: string): string {
  switch (userType) {
    case 'pet-owner':
      return '/dashboard'
    case 'veterinarian':
      return '/vet-dashboard'
    case 'clinic-admin':
    case 'branch-admin':
      return '/clinic-admin'
    default:
      return '/login'
  }
}

/**
 * Find the most specific route permission entry that matches the current pathname.
 * e.g. /clinic-admin/appointments matches /clinic-admin
 */
function getMatchedRoutePermissions(pathname: string): string[] | null {
  // Sort routes by specificity (longer paths first) to match most specific first
  const sortedRoutes = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length)

  for (const route of sortedRoutes) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return ROUTE_PERMISSIONS[route]
    }
  }
  return null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const authToken = request.cookies.get('authToken')?.value
  const userType = request.cookies.get('userType')?.value
  const isAuthenticated = !!authToken

  // ── Redirect logged-in users away from auth pages ──────────────────────
  if (AUTH_ONLY_ROUTES.includes(pathname)) {
    if (isAuthenticated && userType) {
      return NextResponse.redirect(
        new URL(getDashboardForUserType(userType), request.url)
      )
    }
    return NextResponse.next()
  }

  // ── Check protected routes ──────────────────────────────────────────────
  const allowedRoles = getMatchedRoutePermissions(pathname)

  if (allowedRoles) {
    // Not logged in — send to the right login page
    if (!isAuthenticated) {
      const loginPath = pathname.startsWith('/clinic-admin')
        ? '/clinic-login'
        : '/login'
      const loginUrl = new URL(loginPath, request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Logged in but wrong role — redirect to their own dashboard
    if (userType && !allowedRoles.includes(userType)) {
      return NextResponse.redirect(
        new URL(getDashboardForUserType(userType), request.url)
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static files.
     * This ensures the middleware runs on every page navigation.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
