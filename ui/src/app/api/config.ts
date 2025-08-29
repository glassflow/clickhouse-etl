// Server-side environment variable configuration for API routes
// API routes run on the server, so we can access process.env directly
// The startup.sh script sets these environment variables at runtime

/**
 * Helper function to ensure API URL has the correct /api/v1 suffix
 * Users should only need to provide the base URL (e.g., http://app:8081)
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

export const runtimeConfig = {
  // apiUrl: 'http://app:8081/api/v1', // Direct URL for Docker environment
  apiUrl: ensureApiV1Suffix(process.env.NEXT_PUBLIC_API_URL || 'http://app:8081'),
  previewMode: process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' || false,
}

// This configuration will be available at runtime
export default runtimeConfig
