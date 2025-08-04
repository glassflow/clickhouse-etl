'use client'

import React, { useEffect, useState } from 'react'
import { cn } from '@/src/utils/common.client'
import { Button } from '@/src/components/ui/button'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import PlusIcon from '../../images/plus.svg'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

export function NoPipelines() {
  const analytics = useJourneyAnalytics()
  const router = useRouter()

  // Check if feedback was already submitted
  useEffect(() => {
    // Track page view when component loads
    analytics.page.pipelines({})
  }, [])

  const handleCreatePipeline = () => {
    router.push('/home')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-2xl font-semibold text-foreground">There is no pipeline to display</h2>
        <p className="text-sm text-muted-foreground">Create your first pipeline to get started</p>
      </div>

      <Button variant="outline" className="btn-primary flex items-center gap-2" onClick={handleCreatePipeline}>
        <Image
          src={PlusIcon}
          alt="New Pipeline"
          width={16}
          height={16}
          className="filter brightness-0" // Makes the icon black to match text
        />
        New Pipeline
      </Button>
    </div>
  )
}
