import { getApiUrl, getPreviewMode } from '@/src/utils/env'

// Runtime configuration for API routes
export const runtimeConfig = {
  apiUrl: getApiUrl(),
  previewMode: getPreviewMode(),
}

// This configuration will be available at runtime
export default runtimeConfig
