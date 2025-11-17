import { auth0 } from '@/src/lib/auth0'
import { NextRequest } from 'next/server'

// Handle Auth0 authentication routes: /api/auth/login, /api/auth/logout, /api/auth/callback, /api/auth/me
// In App Router with SDK v4, we need to use the middleware approach
export async function GET(request: NextRequest) {
  // Delegate to Auth0 middleware to handle all auth routes
  return auth0.middleware(request)
}
