'use client'

import React, { useEffect, useState } from 'react'
import { PipelinesList } from '@/src/modules/pipelines/PipelinesList'
import { NoPipelines } from '@/src/modules/pipelines/NoPipelines'

import { getPipelines, Pipeline } from '@/src/api/pipeline-api'

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])

  const fetchPipelines = async () => {
    const pipelines = await getPipelines()
    setPipelines(pipelines)

    console.log(pipelines)
  }

  useEffect(() => {
    fetchPipelines()
  }, [])

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] gap-12">
        {pipelines.length > 0 ? <PipelinesList pipelines={pipelines} /> : <NoPipelines />}
      </div>
    </div>
  )
}
