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
      NEXT_PUBLIC_DASHBOARD?: string
      NEXT_PUBLIC_AUTH0_ENABLED?: string
      NEXT_PUBLIC_AUTH0_PROFILE?: string
      NEXT_PUBLIC_LOG_LEVEL?: string
      NEXT_PUBLIC_OTEL_LOGS_ENABLED?: string
      NEXT_PUBLIC_OTEL_METRICS_ENABLED?: string
      NEXT_PUBLIC_OTEL_SERVICE_NAME?: string
      NEXT_PUBLIC_OTEL_SERVICE_VERSION?: string
      NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE?: string
      NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID?: string
      NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT?: string
      NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS?: string
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
