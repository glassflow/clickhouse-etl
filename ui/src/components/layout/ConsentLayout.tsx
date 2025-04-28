'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/src/store'
import { ConsentDialog } from '../ConsentDialog'
import {
  initAnalytics,
  setAnalyticsEnabled,
  loadAnalyticsPreference,
  track,
  dictionary,
  setUserIdentity,
} from '@/src/analytics/eventManager'
// Use the existing UUID package that's already installed as a dependency
// Dynamically import only on the client side to avoid SSR issues
import { v4 as uuidv4 } from 'uuid'

interface ConsentLayoutProps {
  children: React.ReactNode
}

const CONSENT_STORAGE_KEY = 'glassflow-analytics-consent'
const CONSENT_ANSWERED_KEY = 'glassflow-consent-answered'
const USER_ID_STORAGE_KEY = 'glassflow-user-id'

export function ConsentLayout({ children }: ConsentLayoutProps) {
  const { consentAnswered, setAnalyticsConsent, setConsentAnswered } = useStore()
  const [showConsent, setShowConsent] = useState(false)

  // Initialize analytics on component mount and ensure user ID exists
  useEffect(() => {
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

  // Load consent from localStorage when component mounts
  useEffect(() => {
    const savedConsentAnswered = localStorage.getItem(CONSENT_ANSWERED_KEY)
    const savedConsent = localStorage.getItem(CONSENT_STORAGE_KEY)

    if (savedConsentAnswered === 'true') {
      const consentValue = savedConsent === 'true'
      setConsentAnswered(true)
      setAnalyticsConsent(consentValue)

      // Also set the analytics enabled state in our analytics module
      setAnalyticsEnabled(consentValue)
    } else {
      setShowConsent(!consentAnswered)
    }
  }, [])

  // Update showConsent when consentAnswered changes
  useEffect(() => {
    setShowConsent(!consentAnswered)
  }, [consentAnswered])

  const handleConsentClick = (value: boolean) => {
    // Save to store
    setAnalyticsConsent(value)
    setConsentAnswered(true)

    // Enable or disable analytics based on consent
    setAnalyticsEnabled(value)

    // Save to localStorage
    localStorage.setItem(CONSENT_STORAGE_KEY, value.toString())
    localStorage.setItem(CONSENT_ANSWERED_KEY, 'true')

    // Track the consent decision (only if consent was given)
    if (value) {
      track({
        event: dictionary.userPreference,
        context: 'analyticsConsent',
        properties: {
          consentGiven: value,
        },
      })
    }

    // Hide dialog
    setShowConsent(false)
  }

  return (
    <>
      {children}
      {showConsent && (
        <div className="fixed bottom-8 right-8 z-50 max-w-[488px] animate-slideUpFade">
          <ConsentDialog showConsent={showConsent} onConsentClick={handleConsentClick} />
        </div>
      )}
    </>
  )
}
