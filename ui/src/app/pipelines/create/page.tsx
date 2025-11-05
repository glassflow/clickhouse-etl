'use client'

import { Suspense } from 'react'
import PipelineWizard from '@/src/modules/create/PipelineWizard'

export default function CreatePipelinePage() {
  return (
    <div className="flex items-start justify-center min-h-[var(--main-container-width)] min-w-[var(--main-container-width)] py-8">
      <Suspense fallback={<div>Loading...</div>}>
        <PipelineWizard />
      </Suspense>
    </div>
  )
}
