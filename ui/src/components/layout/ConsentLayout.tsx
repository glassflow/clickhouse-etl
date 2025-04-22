'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/src/store'
import { ConsentDialog } from '../ConsentDialog'

interface ConsentLayoutProps {
  children: React.ReactNode
}

export function ConsentLayout({ children }: ConsentLayoutProps) {
  const { consentAnswered, setAnalyticsConsent, setConsentAnswered } = useStore()
  const [showConsent, setShowConsent] = useState(false)

  // Initialize showConsent based on consentAnswered
  useEffect(() => {
    setShowConsent(!consentAnswered)
  }, [consentAnswered])

  const handleConsentClick = (value: boolean) => {
    setAnalyticsConsent(value)
    setConsentAnswered(true)
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
