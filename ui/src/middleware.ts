import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth0 } from './lib/auth0'

// Check if Auth0 is enabled via environment variable
const isAuthEnabled = process.env.NEXT_PUBLIC_AUTH0_ENABLED === 'true'

// Conditional middleware: only apply auth if enabled
export default async function middleware(request: NextRequest) {
  // If auth is disabled, pass through all requests
  if (!isAuthEnabled) {
    return NextResponse.next()
  }

  // Let Auth0 SDK handle all its routes
  if (request.nextUrl.pathname.startsWith('/api/auth/')) {
    const response = await auth0.middleware(request)
    return response
  }

  // For all other routes, just pass through
  return NextResponse.next()
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    // Run middleware on Auth0 routes
    '/api/auth/:path*',
  ],
}
