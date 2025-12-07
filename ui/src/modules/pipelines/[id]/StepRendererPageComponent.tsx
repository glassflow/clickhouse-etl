'use client'

import React from 'react'
import Image from 'next/image'
import Loader from '@/src/images/loader-small.svg'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/src/components/ui/card'

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
    <Card className="card-dark mt-6 w-full animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              <h2 className="text-xl font-semibold">{stepInfo.title}</h2>
            </CardTitle>
            <CardDescription>
              <p className="text-sm text-[var(--color-foreground-neutral-faded)]">{stepInfo.description}</p>
            </CardDescription>
          </div>
          {isLoading && (
            <div className="flex items-center gap-2">
              <Image src={Loader} alt="Loading" width={16} height={16} className="animate-spin" />
              <span className="text-sm text-blue-600">{loadingText}</span>
            </div>
          )}
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)]">{children}</CardContent>
    </Card>
  )
}

export default StepRendererPageComponent
