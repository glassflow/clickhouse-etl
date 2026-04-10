import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAuthEnabled } from './utils/auth-config.server'

const GLASSFLOW_WEBSITE_COOKIE = 'gf_from_website'
const GLASSFLOW_DOMAIN = 'glassflow.dev'
const COOKIE_MAX_AGE_SECONDS = 3600 // 1 hour

function isFromGlassflowWebsite(request: NextRequest): boolean {
  const referer = request.headers.get('referer') ?? ''
  const refParam = request.nextUrl.searchParams.get('ref') ?? ''
  return referer.includes(GLASSFLOW_DOMAIN) || refParam.includes(GLASSFLOW_DOMAIN)
}

// Conditional proxy: only apply auth if enabled (Next.js 16+ proxy convention)
export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Always allow /ui-api routes to pass through - they handle their own authentication if needed
  if (pathname.startsWith('/ui-api')) {
    return NextResponse.next()
  }

  // On the root path, detect glassflow.dev referral and persist it in a cookie
  // so the marketing landing page renders even after a hard reload.
  if (pathname === '/') {
    const alreadyTagged = request.cookies.get(GLASSFLOW_WEBSITE_COOKIE)?.value === '1'
    if (!alreadyTagged && isFromGlassflowWebsite(request)) {
      const response = NextResponse.next()
      response.cookies.set(GLASSFLOW_WEBSITE_COOKIE, '1', {
        maxAge: COOKIE_MAX_AGE_SECONDS,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      })
      return response
    }
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
