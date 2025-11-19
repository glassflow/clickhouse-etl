/**
 * Server-side Auth0 configuration utilities
 *
 * IMPORTANT: This module is for server components only.
 * It reads from the actual process.env at runtime, not from build-time values.
 */

/**
 * Check if Auth0 authentication is enabled
 * This reads from the actual runtime environment variable, not build-time
 */
export function isAuthEnabled(): boolean {
  // Read from actual process environment at runtime
  // This works in server components because process.env is available
  const authEnabled = process.env.NEXT_PUBLIC_AUTH0_ENABLED
  return authEnabled === 'true'
}

/**
 * Get all Auth0-related environment variables for debugging
 */
export function getAuthConfig() {
  return {
    enabled: isAuthEnabled(),
    domain: process.env.AUTH0_DOMAIN,
    issuerBaseUrl: process.env.AUTH0_ISSUER_BASE_URL,
    clientId: process.env.AUTH0_CLIENT_ID,
    appBaseUrl: process.env.APP_BASE_URL,
    hasSecret: !!process.env.AUTH0_SECRET,
    hasClientSecret: !!process.env.AUTH0_CLIENT_SECRET,
  }
}
