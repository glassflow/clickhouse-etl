'use client'

import { useEffect } from 'react'
import { initAnalytics, setUserIdentity } from '@/src/analytics/eventManager'
import { isAnalyticsEnabled } from '@/src/utils/common.client'
// Use the existing UUID package that's already installed as a dependency
// Dynamically import only on the client side to avoid SSR issues
import { v4 as uuidv4 } from 'uuid'

interface AnalyticsProviderProps {
  children: React.ReactNode
}

const USER_ID_STORAGE_KEY = 'glassflow-user-id'

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  // Initialize analytics on component mount and ensure user ID exists
  useEffect(() => {
    // Only initialize analytics if it's enabled
    if (!isAnalyticsEnabled()) {
      return
    }

    initAnalytics()

    // Get or create user ID for analytics tracking
    let userId = localStorage.getItem(USER_ID_STORAGE_KEY)

    if (!userId) {
      try {
        // Generate a new UUID using the uuid package
        userId = uuidv4()
        localStorage.setItem(USER_ID_STORAGE_KEY, userId)
      } catch (error) {
        // Fallback to timestamp-based ID if UUID generation fails
        console.error('Failed to generate UUID, using fallback:', error)
        const timestamp = Date.now()
        const randomPart = Math.floor(Math.random() * 1000000)
          .toString()
          .padStart(6, '0')
        userId = `${timestamp}-${randomPart}`
        localStorage.setItem(USER_ID_STORAGE_KEY, userId)
      }
    }

    // Set user identity for analytics tracking
    setUserIdentity(userId)
  }, [])

  return <>{children}</>
}
