'use client'

import React from 'react'
import { ChevronLeftIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Button } from '@/src/components/ui/button'

interface StepRendererModalProps {
  children: React.ReactNode
  stepInfo: any
  handleBack: () => void
  onClose: () => void
}

function StepRendererModal({ children, stepInfo, handleBack, onClose }: StepRendererModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden bg-[var(--color-background-elevation-raised-faded-2)] border border-[var(--color-border-neutral)] rounded-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack} className="p-2">
              <ChevronLeftIcon className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-xl font-semibold">{stepInfo.title}</h2>
              <p className="text-sm text-gray-600">{stepInfo.description}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-2">
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">{children}</div>
      </div>
    </div>
  )
}

export default StepRendererModal
