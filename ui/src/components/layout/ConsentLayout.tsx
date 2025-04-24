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
} from '@/src/analytics/eventManager'

interface ConsentLayoutProps {
  children: React.ReactNode
}

const CONSENT_STORAGE_KEY = 'glassflow-analytics-consent'
const CONSENT_ANSWERED_KEY = 'glassflow-consent-answered'

export function ConsentLayout({ children }: ConsentLayoutProps) {
  const { consentAnswered, setAnalyticsConsent, setConsentAnswered } = useStore()
  const [showConsent, setShowConsent] = useState(false)

  // Initialize analytics on component mount
  useEffect(() => {
    initAnalytics()
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <ConsentDialog showConsent={showConsent} onConsentClick={handleConsentClick} />
        </div>
      )}
    </>
  )
}
