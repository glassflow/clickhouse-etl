import { getRuntimeEnv } from '@/src/utils/common.client'

// Type declaration for runtime environment
declare global {
  interface Window {
    __ENV__?: {
      NEXT_PUBLIC_API_URL?: string
      NEXT_PUBLIC_IN_DOCKER?: string
      NEXT_PUBLIC_PREVIEW_MODE?: string
    }
  }
}

// Environment variable priority order:
// 1. Runtime environment (window.__ENV__) - Docker overrides
// 2. Build-time environment (process.env) - .env.local, .env, etc.
// 3. Default values - fallback

// Helper function to get build-time environment variables
// This ensures consistent values between server and client
export const getBuildTimeEnv = (key: string): string | undefined => {
  // Always return the same value for both server and client
  // Next.js should inject these at build time
  return process.env[key]
}

// Helper function to get a specific environment variable with proper priority
export const getEnvVar = (key: string, defaultValue: string = ''): string => {
  const runtimeEnv = getRuntimeEnv()
  const buildTimeEnv = getBuildTimeEnv(key)

  // Priority order: Runtime > Build-time > Default
  // Check for undefined specifically, not falsy values
  let value: string
  if (runtimeEnv[key as keyof typeof runtimeEnv] !== undefined) {
    value = runtimeEnv[key as keyof typeof runtimeEnv]!
  } else if (buildTimeEnv !== undefined) {
    value = buildTimeEnv
  } else {
    value = defaultValue
  }

  // Debug logging in development
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log(`[ENV DEBUG] ${key}:`, {
      runtime: runtimeEnv[key as keyof typeof runtimeEnv],
      buildTime: buildTimeEnv,
      defaultValue,
      finalValue: value,
    })
  }

  return value
}

// Helper function to get boolean environment variables
export const getEnvBool = (key: string, defaultValue: boolean = false): boolean => {
  const value = getEnvVar(key, defaultValue.toString())
  // Only return true for explicit 'true' or '1' values
  // Empty strings, undefined, and other values return false
  return value === 'true' || value === '1'
}

// Specific getters for commonly used environment variables
export const getApiUrl = (): string => {
  return getEnvVar('NEXT_PUBLIC_API_URL', 'http://app:8080/api/v1')
}

export const getInDocker = (): boolean => {
  return getEnvBool('NEXT_PUBLIC_IN_DOCKER', true)
}

export const getPreviewMode = (): boolean => {
  return getEnvBool('NEXT_PUBLIC_PREVIEW_MODE', false)
}

// Debug utility to help troubleshoot environment variable issues
export const debugEnvVars = () => {
  if (typeof window === 'undefined') {
    // Server-side
    console.log('=== Server-side Environment Variables ===')
    console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL)
    console.log('NEXT_PUBLIC_IN_DOCKER:', process.env.NEXT_PUBLIC_IN_DOCKER)
    console.log('NEXT_PUBLIC_PREVIEW_MODE:', process.env.NEXT_PUBLIC_PREVIEW_MODE)
  } else {
    // Client-side
    console.log('=== Client-side Environment Variables ===')
    console.log('Runtime (window.__ENV__):', getRuntimeEnv())
    console.log('Build-time (process.env):', {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_IN_DOCKER: process.env.NEXT_PUBLIC_IN_DOCKER,
      NEXT_PUBLIC_PREVIEW_MODE: process.env.NEXT_PUBLIC_PREVIEW_MODE,
    })
    console.log('Resolved values:')
    console.log('- API URL:', getApiUrl())
    console.log('- In Docker:', getInDocker())
    console.log('- Preview Mode:', getPreviewMode())

    // Additional debugging for development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('=== Development Mode Debug ===')
      console.log('NODE_ENV:', process.env.NODE_ENV)
      console.log(
        'Available process.env keys:',
        Object.keys(process.env).filter((key) => key.startsWith('NEXT_PUBLIC_')),
      )
    }
  }
}
