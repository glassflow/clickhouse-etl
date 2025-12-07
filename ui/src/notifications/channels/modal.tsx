'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import type { NotificationOptions, ModalState } from '../types'

interface ModalContextType {
  showModal: (options: NotificationOptions) => void
  dismissModal: () => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

// Removed variant icons and colors to match toast/ConfirmationModal styling

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null)

  const showModal = useCallback((options: NotificationOptions) => {
    const id = `modal-${Date.now()}-${Math.random()}`
    setModal({
      id,
      options,
      visible: true,
    })
  }, [])

  const dismissModal = useCallback(() => {
    setModal(null)
  }, [])

  const handleAction = useCallback(() => {
    if (modal?.options.action) {
      modal.options.action.onClick()
    }
    dismissModal()
  }, [modal, dismissModal])

  return (
    <ModalContext.Provider value={{ showModal, dismissModal }}>
      {children}
      {modal?.visible && (
        <Dialog open={modal.visible} onOpenChange={(open) => !open && dismissModal()}>
          <DialogContent className="sm:max-w-[500px] bg-[var(--color-background-elevation-raised-faded-2)] surface-gradient-border rounded-md shadow-lg">
            <DialogHeader>
              <DialogTitle className="font-semibold text-lg leading-none text-[var(--color-foreground-neutral)]">
                {modal.options.title}
              </DialogTitle>
              {modal.options.description && (
                <DialogDescription className="pt-2 text-sm text-muted-foreground">
                  {modal.options.description}
                </DialogDescription>
              )}
            </DialogHeader>

            {(modal.options.action || modal.options.reportLink) && (
              <div className="px-0 pb-0 border-[var(--color-border-neutral)] pt-4">
                {modal.options.action && (
                  <div className="text-sm pt-2">
                    <strong>What to do:</strong> {modal.options.action.label}
                  </div>
                )}
                {modal.options.reportLink && (
                  <div className="text-sm text-muted-foreground pt-2">
                    If the issue persists, please{' '}
                    <a
                      href={modal.options.reportLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline text-[var(--color-foreground-primary)]"
                    >
                      submit a report
                    </a>{' '}
                    so we can investigate.
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="border-[var(--color-border-neutral)] pt-4 mt-0">
              {modal.options.action && (
                <Button onClick={handleAction} className="btn-primary">
                  {modal.options.action.label}
                </Button>
              )}
              <Button variant="outline" onClick={dismissModal} className="btn-tertiary">
                {modal.options.action ? 'Close' : 'OK'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ModalContext.Provider>
  )
}

export function useModal() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within ModalProvider')
  }
  return context
}
