'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

export function LogViewer() {
  const [logs, setLogs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_URL}/logs`)
        if (!response.ok) {
          throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`)
        }
        const data = await response.json()
        setLogs(data.logs || [])
        setIsLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch logs')
        setIsLoading(false)
      }
    }

    // Initial fetch
    fetchLogs()

    // Set up polling interval (every 5 seconds)
    const intervalId = setInterval(fetchLogs, 5000)

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId)
  }, [])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        <p>{error}</p>
        <p className="text-sm mt-1">Please check if the server is running and try again.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 text-gray-100 rounded-lg p-4">
      <div ref={logContainerRef} className="h-[600px] overflow-y-auto font-mono text-sm whitespace-pre-wrap">
        {logs.map((log, index) => (
          <div key={index} className="py-1">
            {log}
          </div>
        ))}
      </div>
    </div>
  )
}
