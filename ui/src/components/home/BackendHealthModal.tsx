'use client'

import { useState, useEffect } from 'react'
import { HealthCheckDialog } from '../shared/HealthCheckDialog'
import { useHealthCheck } from '@/src/hooks/useHealthCheck'

interface BackendHealthModalProps {
  onHealthCheckComplete?: (isConnected: boolean) => void
}

export function BackendHealthModal({ onHealthCheckComplete }: BackendHealthModalProps) {
  const [showModal, setShowModal] = useState(false)
  const { isConnected, isLoading, performHealthCheck } = useHealthCheck(false) // Don't auto-check

  // Check health on mount and show modal if backend is unavailable
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await performHealthCheck()
        // If we get here, backend is available, don't show modal
      } catch (error) {
        // Health check failed, backend is unavailable, show modal
        setShowModal(true)
      }
    }

    checkHealth()
  }, [performHealthCheck])

  const handleTestConnection = async () => {
    try {
      const result = await performHealthCheck()
      if (result.success) {
        setShowModal(false)
        onHealthCheckComplete?.(true)
      }
    } catch (error) {
      // Health check failed, keep modal open
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    onHealthCheckComplete?.(false)
  }

  if (!showModal) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-w-[488px] w-full mx-4 relative">
        <HealthCheckDialog
          showHealthCheck={showModal}
          onTestConnection={handleTestConnection}
          isConnected={isConnected}
          isLoading={isLoading}
        />
        <button
          onClick={handleCloseModal}
          className="absolute -top-2 -right-2 text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-full p-1 shadow-md"
          aria-label="Close health check dialog"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
