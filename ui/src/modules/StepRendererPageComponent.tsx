'use client'

import React from 'react'
import Image from 'next/image'
import Loader from '@/src/images/loader-small.svg'

interface StepRendererPageComponentProps {
  children: React.ReactNode
  stepInfo: any
  handleBack: () => void
  onClose: () => void
  isLoading?: boolean
  loadingText?: string
}

function StepRendererPageComponent({
  children,
  stepInfo,
  handleBack,
  onClose,
  isLoading = false,
  loadingText = 'Processing...',
}: StepRendererPageComponentProps) {
  return (
    <div className="mt-6 w-full bg-[var(--color-background-elevation-raised-faded-2)] border border-[var(--color-border-neutral)] rounded-md animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-xl font-semibold">{stepInfo.title}</h2>
          <p className="text-sm text-gray-600">{stepInfo.description}</p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2">
            <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />
            <span className="text-sm text-blue-600">{loadingText}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">{children}</div>
    </div>
  )
}

export default StepRendererPageComponent
