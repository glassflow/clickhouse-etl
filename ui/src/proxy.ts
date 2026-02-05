import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAuthEnabled } from './utils/auth-config.server'

// Conditional proxy: only apply auth if enabled (Next.js 16+ proxy convention)
export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Always allow /ui-api routes to pass through - they handle their own authentication if needed
  if (pathname.startsWith('/ui-api')) {
    return NextResponse.next()
  }

  // Check Auth0 status at runtime
  const authEnabled = isAuthEnabled()

  // If auth is disabled, allow root page to handle its own redirect logic based on pipelines
  // This is now handled in app/page.tsx which checks for pipelines server-side
  if (!authEnabled) {
    return NextResponse.next()
  }

  // When auth is enabled, let all routes pass through
  // Auth checking is done in:
  // 1. API routes: /api/auth/[auth0]/route.ts handles Auth0 flows
  // 2. Page components: use getSession() server-side or useUser() client-side
  // 3. This avoids proxy cookie parsing issues with Auth0 SDK
  return NextResponse.next()
}

// Configure which routes the proxy runs on (Next.js 16+)
export const config = {
  matcher: [
    // Run proxy on Auth0 routes
    '/api/auth/:path*',
    // Protected page routes
    '/',
    '/home',
    '/pipelines',
    '/pipelines/:path*',
    // Explicitly include /ui-api to ensure it's handled (though we pass it through)
    '/ui-api/:path*',
  ],
}
