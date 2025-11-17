import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Check if Auth0 is enabled via environment variable
const isAuthEnabled = process.env.NEXT_PUBLIC_AUTH0_ENABLED === 'true'

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

  // When auth is enabled, let all routes pass through
  // Auth checking is done in:
  // 1. API routes: /api/auth/[auth0]/route.ts handles Auth0 flows
  // 2. Page components: use getSession() server-side or useUser() client-side
  // 3. This avoids middleware cookie parsing issues with Auth0 SDK
  return NextResponse.next()
}

// Configure which routes the middleware runs on
export const config = {
  runtime: 'nodejs', // Use Node.js runtime instead of Edge Runtime (Next.js 15.2+)
  matcher: [
    // Run middleware on Auth0 routes
    '/api/auth/:path*',
    // Protected page routes
    '/',
    '/home',
    '/pipelines',
    '/pipelines/:path*',
  ],
}
