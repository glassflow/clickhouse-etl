'use client'

import React, { useEffect, useState } from 'react'
import { cn } from '@/src/utils'
import { Button } from '@/src/components/ui/button'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ModifyIcon from '../../images/modify.svg'
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
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <h1 className={cn('text-2xl font-semibold')}>There is pipeline to display</h1>
        <h3 className="text-sm text-foreground-neutral-muted">Create your first pipeline to get started</h3>
      </div>

      <Button variant="outline" className="btn-primary flex items-center gap-2" onClick={handleCreatePipeline}>
        <Image src={ModifyIcon} alt="Modify & Restart" width={16} height={16} />
        Modify & Restart
      </Button>
    </div>
  )
}
