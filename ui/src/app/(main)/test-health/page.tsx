'use client'

import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { checkBackendHealth } from '@/src/api/health'

export default function TestHealthPage() {
  const [healthStatus, setHealthStatus] = useState<string>('Not tested')
  const [isLoading, setIsLoading] = useState(false)

  const handleTestHealth = async () => {
    setIsLoading(true)
    try {
      const result = await checkBackendHealth()
      setHealthStatus(result.success ? 'Healthy' : 'Unhealthy')
    } catch (error: any) {
      setHealthStatus(`Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-md w-full space-y-6">
        <h1 className="text-2xl font-bold text-center">Health Check Test</h1>

        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Backend Health Status</h2>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">Status:</span>
              <span
                className={`px-2 py-1 rounded text-sm ${
                  healthStatus === 'Healthy'
                    ? 'bg-green-100 text-green-800'
                    : healthStatus === 'Unhealthy'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                }`}
              >
                {healthStatus}
              </span>
            </div>

            <Button onClick={handleTestHealth} disabled={isLoading} className="w-full">
              {isLoading ? 'Testing...' : 'Test Backend Health'}
            </Button>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>This page tests the health check functionality.</p>
          <p>The health check dialog should appear in the top right corner.</p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                localStorage.removeItem('glassflow-health-check-shown')
                window.location.reload()
              }}
            >
              Reset Health Check Dialog
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = window.location.pathname + '?showHealthCheck=true'
              }}
            >
              Show Health Check Dialog
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
