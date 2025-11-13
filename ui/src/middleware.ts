import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth0 } from './lib/auth0'

// Check if Auth0 is enabled via environment variable
const isAuthEnabled = process.env.NEXT_PUBLIC_AUTH0_ENABLED === 'true'

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/']

// Conditional middleware: only apply auth if enabled
export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // If auth is disabled, redirect root to /home and pass through everything else
  if (!isAuthEnabled) {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/home', request.url))
    }
    return NextResponse.next()
  }

  // Let Auth0 SDK handle all its routes
  if (pathname.startsWith('/api/auth/')) {
    try {
      const response = await auth0.middleware(request)
      return response
    } catch (error) {
      console.error('[Middleware] Auth0 SDK error:', error)
      return NextResponse.next()
    }
  }

  // Check if this is a public route
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

  // For all other routes, check if user is authenticated
  try {
    const session = await auth0.getSession(request)

    // If user is authenticated and on root, redirect to /home
    if (session && pathname === '/') {
      return NextResponse.redirect(new URL('/home', request.url))
    }

    // If no session and on root (public), allow access
    if (!session && isPublicRoute) {
      return NextResponse.next()
    }

    // If no session and trying to access protected route, redirect to root (landing page)
    if (!session && !isPublicRoute) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // User is authenticated, allow access
    return NextResponse.next()
  } catch (error) {
    // Error checking session - redirect to root if not public
    if (!isPublicRoute) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    // Run middleware on Auth0 routes
    '/api/auth/:path*',
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
