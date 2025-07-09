'use client'

import { useEffect, useState } from 'react'
import { debugEnvVars } from '@/src/utils/env'
import { getRuntimeEnv } from '@/src/utils/common.client'

export function EnvDebug() {
  const [mounted, setMounted] = useState(false)
  const [envValues, setEnvValues] = useState({
    apiUrl: '',
    inDocker: false,
    previewMode: false,
  })

  const runtimeEnv = getRuntimeEnv()

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV === 'development') {
      console.log('=== Environment Variables Debug ===')
      debugEnvVars()
      console.log('==================================')

      // Set values after component mounts using direct access
      setEnvValues({
        apiUrl: runtimeEnv.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://app:8080/api/v1',
        inDocker: runtimeEnv.NEXT_PUBLIC_IN_DOCKER === 'true' || process.env.NEXT_PUBLIC_IN_DOCKER === 'true',
        previewMode: runtimeEnv.NEXT_PUBLIC_PREVIEW_MODE === 'true' || process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true',
      })
    }

    setMounted(true)
  }, [])

  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        background: '#000',
        color: '#f5f5f5',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 9999,
        maxWidth: '300px',
      }}
    >
      <strong>Env Debug (Dev Only)</strong>
      <br />
      API URL: {envValues.apiUrl}
      <br />
      In Docker: {envValues.inDocker.toString()}
      <br />
      Preview Mode: {envValues.previewMode.toString()}
      <br />
      <small>Check console for detailed info</small>
    </div>
  )
}
