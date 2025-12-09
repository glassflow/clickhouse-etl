'use client'

import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { usePipelineHealth } from '@/src/hooks/usePipelineHealth'
import { PipelineHealthStatus } from '@/src/api/pipeline-health'

export default function TestPipelineHealthPage() {
  const [pipelineId, setPipelineId] = useState('test-pipeline-123')
  const [enabled, setEnabled] = useState(false)

  const { health, isLoading, error, isPolling, startPolling, stopPolling } = usePipelineHealth({
    pipelineId,
    enabled,
    pollingInterval: 3000,
    onStatusChange: (newStatus, previousStatus) => {
      // console.log(`Status changed: ${previousStatus} → ${newStatus}`)
    },
    onError: (error) => {
      console.error('Health check error:', error)
    },
  })

  const handleStartPolling = () => {
    setEnabled(true)
    startPolling()
  }

  const handleStopPolling = () => {
    setEnabled(false)
    stopPolling()
  }

  const getStatusColor = (status: PipelineHealthStatus) => {
    switch (status) {
      case 'Running':
        return 'text-green-600'
      case 'Created':
        return 'text-blue-600'
      case 'Terminating':
        return 'text-orange-600'
      case 'Terminated':
        return 'text-gray-600'
      case 'Failed':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-2xl w-full space-y-6">
        <h1 className="text-3xl font-bold text-center">Pipeline Health Test</h1>

        <Card className="card-dark">
          <CardHeader>
            <CardTitle>Test Pipeline Health Endpoint</CardTitle>
            <CardDescription>Enter a pipeline ID and test the health endpoint with real-time polling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value)}
                placeholder="Enter pipeline ID"
                className="flex-1"
              />
              <Button onClick={handleStartPolling} disabled={enabled}>
                Start Polling
              </Button>
              <Button onClick={handleStopPolling} disabled={!enabled} variant="outline">
                Stop Polling
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <span
                  className={`px-2 py-1 rounded text-sm ${isLoading ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                >
                  {isLoading ? 'Loading...' : isPolling ? 'Polling' : 'Idle'}
                </span>
              </div>

              {health && (
                <div className="border rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold">Health Data:</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Pipeline ID: {health.pipeline_id}</div>
                    <div>Pipeline Name: {health.pipeline_name}</div>
                    <div className={`font-medium ${getStatusColor(health.overall_status)}`}>
                      Status: {health.overall_status}
                    </div>
                    <div>Created: {new Date(health.created_at).toLocaleString()}</div>
                    <div>Updated: {new Date(health.updated_at).toLocaleString()}</div>
                  </div>
                </div>
              )}

              {error && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <h3 className="font-semibold text-red-800">Error:</h3>
                  <div className="text-sm text-red-700">
                    <div>Code: {error.code}</div>
                    <div>Message: {error.message}</div>
                  </div>
                </div>
              )}

              {!health && !error && !isLoading && (
                <div className="text-center text-gray-500 py-8">
                  No health data available. Start polling to see results.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
