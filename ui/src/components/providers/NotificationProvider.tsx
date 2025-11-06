'use client'

import { useEffect } from 'react'
import { BannerProvider, useBanner } from '@/src/notifications/channels/banner-provider'
import { ModalProvider, useModal } from '@/src/notifications/channels/modal'
import { setBannerContext, setModalContext } from '@/src/notifications/notify'

function NotificationContextSetup() {
  const { showBanner } = useBanner()
  const { showModal } = useModal()

  useEffect(() => {
    setBannerContext({ showBanner })
    setModalContext({ showModal })
  }, [showBanner, showModal])

  return null
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  return (
    <BannerProvider>
      <ModalProvider>
        <NotificationContextSetup />
        {children}
      </ModalProvider>
    </BannerProvider>
  )
}
