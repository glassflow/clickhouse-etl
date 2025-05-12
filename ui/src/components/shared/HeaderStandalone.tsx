'use client'

import { useState } from 'react'
import Image from 'next/image'
import logoFullName from '../../images/logo-full-name.svg'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useStore } from '@/src/store'
import { InfoModal, ModalResult } from '@/src/components/common/Modal'
import { Button } from '@/src/components/ui/button'
export function HeaderStandalone() {
  const router = useRouter()
  const pathname = usePathname()
  const { resetPipelineState } = useStore()

  // Replace individual modal states with a single modal state object
  const [modalProps, setModalProps] = useState({
    visible: false,
    message: 'Returning to the first step will reset the pipeline! Are you sure you want to perform this action?',
    title: 'Reset pipeline state',
    okButtonText: 'Yes',
    cancelButtonText: 'No',
    type: 'info' as 'info' | 'warning' | 'error',
  })

  const handleLogoClick = () => {
    if (pathname !== '/home') {
      setModalProps((prev) => ({ ...prev, visible: true }))
    }
  }

  const handleModalComplete = (result: string) => {
    setModalProps((prev) => ({ ...prev, visible: false }))

    if (result === ModalResult.YES) {
      // Clear the pipeline state
      resetPipelineState('', true)
      router.push('/home')
    }
  }

  return (
    <header className="h-16 w-full min-w-[var(--main-container-width)] max-w-[var(--main-container-width)] mx-auto pt-8">
      <div className="container h-full">
        <div className="flex items-center justify-center h-full w-full">
          <Button variant="ghost" onClick={handleLogoClick}>
            <div className="flex-shrink-0">
              <Image src={logoFullName} alt="Glassflow Logo" width={140} height={30} />
            </div>
          </Button>
        </div>
      </div>
      <InfoModal
        visible={modalProps.visible}
        title={modalProps.title}
        description={modalProps.message}
        okButtonText={modalProps.okButtonText}
        cancelButtonText={modalProps.cancelButtonText}
        onComplete={handleModalComplete}
      />
    </header>
  )
}
