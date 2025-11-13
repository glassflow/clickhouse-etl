import { Auth0Client } from '@auth0/nextjs-auth0/server'

// Create Auth0 client with explicit route configuration
export const auth0 = new Auth0Client({
  routes: {
    login: '/api/auth/login',
    callback: '/api/auth/callback',
    logout: '/api/auth/logout',
    // profile: '/api/auth/me',
  },
  session: {
    absoluteDuration: 604800, // 7 days
  },
})
