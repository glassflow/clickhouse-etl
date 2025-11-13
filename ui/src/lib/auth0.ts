import { Auth0Client } from '@auth0/nextjs-auth0/server'

// Create Auth0 client with explicit route configuration
// Note: The profile route is configured via NEXT_PUBLIC_PROFILE_ROUTE environment variable
// and cannot be set here (it's not a valid option in the SDK)
export const auth0 = new Auth0Client({
  routes: {
    login: '/api/auth/login',
    callback: '/api/auth/callback',
    logout: '/api/auth/logout',
  },
  session: {
    absoluteDuration: 604800, // 7 days
  },
})
