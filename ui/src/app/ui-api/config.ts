// Server-side environment variable configuration for API routes
// API routes run on the server, so we can access process.env directly
// The startup.sh script sets these environment variables at runtime
//
// IMPORTANT: We use getters to ensure values are read at runtime, not build time.
// Next.js inlines process.env values at build time, so direct reads get baked in.
// Using getters defers the read to actual runtime execution.

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
 * Uses getters to ensure environment variables are read at actual runtime,
 * not inlined at build time by Next.js.
 */
export const runtimeConfig = {
  get apiUrl(): string {
    return ensureApiV1Suffix(process.env.NEXT_PUBLIC_API_URL || 'http://api:8081')
  },
  get previewMode(): boolean {
    return process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true'
  },
}

// This configuration will be available at runtime
export default runtimeConfig
