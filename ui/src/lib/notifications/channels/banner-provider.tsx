'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { Banner } from './banner'
import type { NotificationOptions, BannerState } from '../types'

interface BannerContextType {
  showBanner: (options: NotificationOptions) => void
  dismissBanner: () => void
}

const BannerContext = createContext<BannerContextType | undefined>(undefined)

export function BannerProvider({ children }: { children: React.ReactNode }) {
  const [banner, setBanner] = useState<BannerState | null>(null)

  const showBanner = useCallback((options: NotificationOptions) => {
    const id = `banner-${Date.now()}-${Math.random()}`
    setBanner({
      id,
      options,
      visible: true,
    })
  }, [])

  const dismissBanner = useCallback(() => {
    setBanner(null)
  }, [])

  return (
    <BannerContext.Provider value={{ showBanner, dismissBanner }}>
      {children}
      {banner?.visible && (
        <div className="fixed top-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-top">
          <div className="max-w-7xl mx-auto">
            <Banner options={banner.options} onDismiss={dismissBanner} />
          </div>
        </div>
      )}
    </BannerContext.Provider>
  )
}

export function useBanner() {
  const context = useContext(BannerContext)
  if (!context) {
    throw new Error('useBanner must be used within BannerProvider')
  }
  return context
}
