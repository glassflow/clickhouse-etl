// Server-side environment variable configuration for API routes
// API routes run on the server, so we can access process.env directly
// The startup.sh script sets these environment variables at runtime

export const runtimeConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://app:8080/api/v1',
  previewMode: process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' || false,
}

// This configuration will be available at runtime
export default runtimeConfig
