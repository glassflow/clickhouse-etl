'use client'

import React from 'react'
import { PipelineDeployer } from '@/src/modules/pipelines/PipelineDeployer'

export default function PipelinesPage() {
  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-12">
        <PipelineDeployer />
      </div>
    </div>
  )
}
