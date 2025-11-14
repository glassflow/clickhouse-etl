'use client'

import { useEffect } from 'react'
import { initializeObservability, shutdownObservability } from '@/src/observability'

interface ObservabilityProviderProps {
  children: React.ReactNode
}

/**
 * Provider component to initialize OpenTelemetry observability
 * This should be mounted once at the application root
 */
export function ObservabilityProvider({ children }: ObservabilityProviderProps) {
  useEffect(() => {
    // Initialize observability when the app mounts
    initializeObservability()

    // Cleanup function to shutdown observability
    return () => {
      shutdownObservability().catch((error) => {
        console.error('[Observability] Error during shutdown:', error)
      })
    }
  }, [])

  return <>{children}</>
}
