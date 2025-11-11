'use client'

import { useState, useEffect } from 'react'
import { HealthCheckDialog } from '../shared/HealthCheckDialog'
import { checkBackendHealth } from '@/src/api/health'
import { notify } from '@/src/notifications'
import { networkMessages } from '@/src/notifications/messages'

interface HealthCheckProviderProps {
  children: React.ReactNode
}

export function HealthCheckProvider({ children }: HealthCheckProviderProps) {
  const [showHealthCheck, setShowHealthCheck] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      setIsLoading(true)
      try {
        const result = await checkBackendHealth()
        setIsConnected(result.success)
        // Only show dialog if connection is failing
        setShowHealthCheck(!result.success)

        // Show notification if backend is unavailable
        if (!result.success) {
          notify(
            networkMessages.backendUnavailable(() => {
              checkConnection() // Retry
            }),
          )
        }
      } catch (error) {
        setIsConnected(false)
        setShowHealthCheck(true)

        // Show notification for backend unavailable
        notify(
          networkMessages.backendUnavailable(() => {
            checkConnection() // Retry
          }),
        )
      } finally {
        setIsLoading(false)
      }
    }

    checkConnection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTestConnection = async () => {
    setIsLoading(true)
    try {
      const result = await checkBackendHealth()
      setIsConnected(result.success)
      // Hide dialog if connection is now successful
      setShowHealthCheck(!result.success)

      // Show notification if backend is still unavailable
      if (!result.success) {
        notify(
          networkMessages.backendUnavailable(() => {
            handleTestConnection() // Retry
          }),
        )
      }
    } catch (error) {
      setIsConnected(false)
      setShowHealthCheck(true)

      // Show notification for backend unavailable
      notify(
        networkMessages.backendUnavailable(() => {
          handleTestConnection() // Retry
        }),
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseHealthCheck = () => {
    setShowHealthCheck(false)
  }

  return (
    <>
      {children}
      {/* {showHealthCheck && (
        <div className="fixed top-8 right-8 z-50 max-w-[488px] animate-slideDownFade">
          <HealthCheckDialog
            showHealthCheck={showHealthCheck}
            onTestConnection={handleTestConnection}
            isConnected={isConnected}
            isLoading={isLoading}
          />
          <button
            onClick={handleCloseHealthCheck}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close health check dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )} */}
    </>
  )
}
