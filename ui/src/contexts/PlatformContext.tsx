'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { getPlatformInfo } from '@/src/api/platform-api'
import type { PlatformInfo } from '@/src/types/platform'

interface PlatformContextType {
  platform: PlatformInfo | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined)

export const usePlatform = () => {
  const context = useContext(PlatformContext)
  if (context === undefined) {
    throw new Error('usePlatform must be used within a PlatformProvider')
  }
  return context
}

interface PlatformProviderProps {
  children: React.ReactNode
}

export const PlatformProvider: React.FC<PlatformProviderProps> = ({ children }) => {
  const [platform, setPlatform] = useState<PlatformInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlatform = async () => {
    try {
      setLoading(true)
      setError(null)
      const platformInfo = await getPlatformInfo()
      setPlatform(platformInfo)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch platform info')
      console.error('Platform fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlatform()
  }, [])

  const value: PlatformContextType = {
    platform,
    loading,
    error,
    refetch: fetchPlatform,
  }

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
}
