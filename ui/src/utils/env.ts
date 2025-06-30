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

// Utility function to get runtime environment variables
export const getRuntimeEnv = () => {
  if (typeof window !== 'undefined' && window.__ENV__) {
    return window.__ENV__
  }
  return {}
}

// Helper function to get a specific environment variable with fallback
export const getEnvVar = (key: string, defaultValue: string = ''): string => {
  const runtimeEnv = getRuntimeEnv()
  return runtimeEnv[key as keyof typeof runtimeEnv] || process.env[key] || defaultValue
}

// Helper function to get boolean environment variables
export const getEnvBool = (key: string, defaultValue: boolean = false): boolean => {
  const value = getEnvVar(key, defaultValue.toString())
  return value === 'true'
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
