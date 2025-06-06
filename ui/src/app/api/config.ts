// Runtime configuration for API routes
export const runtimeConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://app:8080/api/v1',
}

// This configuration will be available at runtime
export default runtimeConfig
