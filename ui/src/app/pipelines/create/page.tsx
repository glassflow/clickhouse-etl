'use client'

import PipelineWizard from '@/src/modules/PipelineWizzard'

export default function CreatePipelinePage() {
  return (
    <div className="flex items-start justify-center min-h-[var(--main-container-width)] min-w-[var(--main-container-width)] py-8">
      <PipelineWizard />
    </div>
  )
}
