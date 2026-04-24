'use client'

import { useEffect } from 'react'
import { initializeObservability, shutdownObservability } from '@/src/observability'
import { wireCrossSliceEffects } from '@/src/store/cross-slice-effects'

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
    // Wire cross-slice store effects (subscribe-based, called once at startup)
    wireCrossSliceEffects()

    // Cleanup function to shutdown observability
    return () => {
      shutdownObservability().catch((error) => {
        console.error('[Observability] Error during shutdown:', error)
      })
    }
  }, [])

  return <>{children}</>
}
