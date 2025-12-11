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

/**
 * Safely get the Auth0 session, handling decryption errors gracefully.
 * This is useful when old session cookies exist from previous deployments
 * with different AUTH0_SECRET values.
 *
 * @returns The session object, or null if no session or decryption fails
 */
export async function getSessionSafely() {
  try {
    return await auth0.getSession()
  } catch (error: any) {
    // If decryption fails (e.g., old cookie with different AUTH0_SECRET), treat as no session
    if (error?.code === 'ERR_JWE_DECRYPTION_FAILED') {
      console.warn('Session decryption failed, treating as unauthenticated:', error.message)
      return null
    }
    // Re-throw other errors
    throw error
  }
}
