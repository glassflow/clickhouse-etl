'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { PipelinesList } from '@/src/modules/pipelines/PipelinesList'
import { NoPipelines } from '@/src/modules/pipelines/NoPipelines'

import { getPipelines } from '@/src/api/pipeline-api'
import { ListPipelineConfig, PipelineStatus } from '@/src/types/pipeline'

export default function PipelinesPageClient() {
  const [pipelines, setPipelines] = useState<ListPipelineConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchPipelines = useCallback(async () => {
    try {
      setIsLoading(true)
      const pipelinesData = await getPipelines()
      setPipelines(pipelinesData)
    } catch (error) {
      console.error('Failed to fetch pipelines:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Optimistically update pipeline status in local state
  const updatePipelineStatus = useCallback((pipelineId: string, status: PipelineStatus) => {
    setPipelines((prevPipelines) =>
      prevPipelines.map((pipeline) =>
        pipeline.pipeline_id === pipelineId ? { ...pipeline, status: status, state: status } : pipeline,
      ),
    )
  }, [])

  // Update pipeline name in local state
  const updatePipelineName = useCallback((pipelineId: string, newName: string) => {
    setPipelines((prevPipelines) =>
      prevPipelines.map((pipeline) =>
        pipeline.pipeline_id === pipelineId ? { ...pipeline, name: newName } : pipeline,
      ),
    )
  }, [])

  const updatePipelineTags = useCallback((pipelineId: string, tags: string[]) => {
    setPipelines((prevPipelines) =>
      prevPipelines.map((pipeline) =>
        pipeline.pipeline_id === pipelineId
          ? { ...pipeline, metadata: { ...(pipeline.metadata || {}), tags } }
          : pipeline,
      ),
    )
  }, [])

  // Remove pipeline from local state
  const removePipeline = useCallback((pipelineId: string) => {
    setPipelines((prevPipelines) => prevPipelines.filter((pipeline) => pipeline.pipeline_id !== pipelineId))
  }, [])

  useEffect(() => {
    fetchPipelines()
  }, [fetchPipelines])

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex flex-col items-center justify-start min-h-[calc(100vh-200px)] gap-12">
          <div className="text-center">Loading pipelines...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col items-center justify-start min-h-[calc(100vh-200px)] gap-12">
        {pipelines.length > 0 ? (
          <PipelinesList
            pipelines={pipelines}
            onRefresh={fetchPipelines}
            onUpdatePipelineStatus={updatePipelineStatus}
            onUpdatePipelineName={updatePipelineName}
            onRemovePipeline={removePipeline}
            onUpdatePipelineTags={updatePipelineTags}
          />
        ) : (
          <NoPipelines />
        )}
      </div>
    </div>
  )
}
