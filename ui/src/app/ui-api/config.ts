// Server-side environment variable configuration for API routes
// API routes run on the server, so we can access process.env directly
// The startup.sh script sets these environment variables at runtime
//
// IMPORTANT: We use non-prefixed environment variables (API_URL) for server-side code.
// Next.js inlines all NEXT_PUBLIC_* variables at build time, making them impossible
// to override at runtime. Non-prefixed variables are read from process.env at runtime.
// This follows the same pattern as AUTH0_ENABLED in auth-config.server.ts.

/**
 * Helper function to ensure API URL has the correct /api/v1 suffix
 * Users should only need to provide the base URL (e.g., http://api:8081)
 * This function automatically appends /api/v1 if not present
 */
const ensureApiV1Suffix = (baseUrl: string): string => {
  if (!baseUrl) return baseUrl

  // Remove trailing slash if present
  const cleanUrl = baseUrl.replace(/\/$/, '')

  // Check if it already has /api/v1 suffix
  if (cleanUrl.endsWith('/api/v1')) {
    return cleanUrl
  }

  // Append /api/v1 suffix
  return `${cleanUrl}/api/v1`
}

/**
 * Runtime configuration for server-side API routes.
 * Uses non-prefixed environment variables to ensure they are read at runtime,
 * not inlined at build time by Next.js.
 */
export const runtimeConfig = {
  get apiUrl(): string {
    // Use non-prefixed API_URL - NOT inlined by Next.js, read at runtime
    // Falls back to NEXT_PUBLIC_API_URL for backward compatibility
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://api:8081'
    return ensureApiV1Suffix(apiUrl)
  },
  get previewMode(): boolean {
    return process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true'
  },
}

// This configuration will be available at runtime
export default runtimeConfig
