import { getRuntimeEnv } from '@/src/utils/common.client'

// Type declaration for runtime environment
declare global {
  interface Window {
    __ENV__?: {
      NEXT_PUBLIC_API_URL?: string
      NEXT_PUBLIC_IN_DOCKER?: string
      NEXT_PUBLIC_PREVIEW_MODE?: string
      NEXT_PUBLIC_USE_MOCK_API?: string
      NEXT_PUBLIC_ANALYTICS_ENABLED?: string
      NEXT_PUBLIC_DEMO_MODE?: string
    }
  }
}

/**
 * Helper function to ensure API URL has the correct /api/v1 suffix
 * Users should only need to provide the base URL (e.g., http://app:8080)
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

const runtimeEnv = getRuntimeEnv()
const API_URL = ensureApiV1Suffix(
  runtimeEnv.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://api:8081',
)
