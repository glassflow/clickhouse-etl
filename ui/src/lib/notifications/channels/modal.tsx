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
import { AlertCircle, CheckCircle, Info, TriangleAlert } from 'lucide-react'
import type { NotificationOptions, ModalState } from '../types'

interface ModalContextType {
  showModal: (options: NotificationOptions) => void
  dismissModal: () => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

const variantIcons = {
  success: CheckCircle,
  info: Info,
  warning: TriangleAlert,
  error: AlertCircle,
}

const variantColors = {
  success: 'text-green-600 dark:text-green-400',
  info: 'text-blue-600 dark:text-blue-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
}

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
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <div className="flex items-center gap-3">
                {modal.options.variant && (
                  <div className={variantColors[modal.options.variant]}>
                    {React.createElement(variantIcons[modal.options.variant], {
                      className: 'h-6 w-6',
                    })}
                  </div>
                )}
                <DialogTitle>{modal.options.title}</DialogTitle>
              </div>
              {modal.options.description && (
                <DialogDescription className="pt-2">{modal.options.description}</DialogDescription>
              )}
            </DialogHeader>

            {(modal.options.action || modal.options.reportLink) && (
              <div className="py-4 space-y-2">
                {modal.options.action && (
                  <p className="text-sm">
                    <strong>What to do:</strong> {modal.options.action.label}
                  </p>
                )}
                {modal.options.reportLink && (
                  <p className="text-sm text-muted-foreground">
                    If the issue persists, please{' '}
                    <a
                      href={modal.options.reportLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline"
                    >
                      submit a report
                    </a>{' '}
                    so we can investigate.
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              {modal.options.action && (
                <Button onClick={handleAction} className="btn-primary">
                  {modal.options.action.label}
                </Button>
              )}
              <Button variant="outline" onClick={dismissModal}>
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
