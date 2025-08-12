import { getApiUrl } from '@/src/utils/mock-api'

export interface HealthCheckResponse {
  success: boolean
  status: 'healthy' | 'unhealthy'
  timestamp: string
  message: string
}

export interface HealthCheckError {
  code: number
  message: string
}

export const checkBackendHealth = async (): Promise<HealthCheckResponse> => {
  try {
    const url = getApiUrl('healthz')
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Check if the response is successful (200-299 status codes)
    if (response.ok) {
      return {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'Backend is healthy',
      }
    } else {
      // Try to parse error message from response
      let errorMessage = `Backend health check failed with status ${response.status}`
      try {
        const data = await response.json()
        errorMessage = data.message || errorMessage
      } catch {
        // If we can't parse JSON, use the status text
        errorMessage = response.statusText || errorMessage
      }

      throw {
        code: response.status,
        message: errorMessage,
      } as HealthCheckError
    }
  } catch (error: any) {
    console.error('Health check error:', error)

    if (error.code) {
      throw error
    }

    throw {
      code: 500,
      message: error.message || 'Failed to check backend health',
    } as HealthCheckError
  }
}

// Mock health check for development/testing
export const mockHealthCheck = async (): Promise<HealthCheckResponse> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  // Simulate 90% success rate for realistic testing
  const isHealthy = Math.random() > 0.1

  if (isHealthy) {
    return {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'Mock backend is healthy',
    }
  } else {
    throw {
      code: 503,
      message: 'Mock backend is unhealthy',
    } as HealthCheckError
  }
}
