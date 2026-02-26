'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/src/store'
import { StepKeys } from '@/src/config/constants'
import { Button } from '@/src/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import yaml from 'js-yaml'
import { useRouter } from 'next/navigation'
import { generateApiConfig, getMappingType } from '../clickhouse/utils'
import { ReviewConfigurationProps } from './types'
import { ClickhouseDestinationPreview } from './ClickhouseDestinationPreview'
import { ClickhouseConnectionPreview } from './ClickhouseConnectionPreview'
import { KafkaConnectionPreview } from './KafkaConnectionPreview'
import { EditorWrapper } from './EditorWrapper'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { createPipeline } from '@/src/api/pipeline-api'
import { Pipeline } from '@/src/types/pipeline'
import { isFiltersEnabled, isTransformationsEnabled } from '@/src/config/feature-flags'

export function ReviewConfiguration({ steps, onCompleteStep, validate }: ReviewConfigurationProps) {
  const {
    kafkaStore,
    clickhouseConnectionStore,
    clickhouseDestinationStore,
    topicsStore,
    joinStore,
    coreStore,
    deduplicationStore,
    filterStore,
    transformationStore,
  } = useStore()
  const { apiConfig, pipelineId, setPipelineId, pipelineName, pipelineVersion } = coreStore
  const { clickhouseConnection } = clickhouseConnectionStore
  const { clickhouseDestination } = clickhouseDestinationStore
  const router = useRouter()
  const selectedTopics = Object.values(topicsStore.topics || {})
  const analytics = useJourneyAnalytics()

  const [activeTab, setActiveTab] = useState('overview')
  const [jsonContent, setJsonContent] = useState('')
  const [yamlContent, setYamlContent] = useState('')
  const [apiConfigContent, setApiConfigContent] = useState('')
  const [deployError, setDeployError] = useState<string | null>(null)

  // Compute config from current stores so display and deploy always reflect latest state
  const effectiveConfig = useMemo(() => {
    const result = generateApiConfig({
      pipelineId,
      pipelineName: pipelineName || 'Pipeline',
      setPipelineId,
      clickhouseConnection,
      clickhouseDestination,
      selectedTopics,
      getMappingType,
      joinStore,
      kafkaStore,
      deduplicationStore,
      filterStore,
      transformationStore,
      version: pipelineVersion,
    })
    return result
  }, [
    pipelineId,
    pipelineName,
    setPipelineId,
    clickhouseConnection,
    clickhouseDestination,
    selectedTopics,
    joinStore,
    kafkaStore,
    deduplicationStore,
    filterStore,
    transformationStore,
    pipelineVersion,
  ])

  const configError = effectiveConfig && typeof effectiveConfig === 'object' && 'error' in effectiveConfig

  // Derive JSON/YAML/API content from effective config (or fallback to store apiConfig on error)
  useEffect(() => {
    const target = configError
      ? typeof apiConfig === 'object' && apiConfig && !('error' in apiConfig)
        ? apiConfig
        : {}
      : typeof effectiveConfig === 'object' && effectiveConfig && !('error' in effectiveConfig)
        ? effectiveConfig
        : {}
    setJsonContent(JSON.stringify(target, null, 2))
    setYamlContent(yaml.dump(target, { indent: 2 }))
    setApiConfigContent(JSON.stringify(target, null, 2))
  }, [effectiveConfig, configError, apiConfig])

  const handleContinueToPipelines = async () => {
    if (validate && !validate(StepKeys.REVIEW_CONFIGURATION, {})) {
      return
    }
    setDeployError(null)
    const payload = configError ? (apiConfig as Partial<Pipeline>) : (effectiveConfig as Partial<Pipeline>)
    if (!payload || typeof payload !== 'object' || 'error' in payload) {
      setDeployError('Configuration is invalid. Fix the pipeline steps and try again.')
      return
    }
    try {
      const pipeline = await createPipeline(payload)
      setPipelineId(pipeline.pipeline_id || (payload as any).pipeline_id || '')
      router.push('/pipelines')
    } catch (error: any) {
      console.error('Failed to deploy pipeline:', error)
      const message = error?.message || error?.error || 'Failed to deploy pipeline. Please try again.'
      setDeployError(message)
    }
  }

  // Safely render topics
  const renderTopics = () => {
    if (!selectedTopics || !Array.isArray(selectedTopics) || selectedTopics.length === 0) {
      return <li>No topics selected</li>
    }

    return selectedTopics.map((topic: any, index: number) => {
      // Handle different possible topic formats
      const topicName = typeof topic === 'string' ? topic : topic?.name || JSON.stringify(topic)

      return (
        <li key={index} className="mb-4">
          <div className="font-medium">{topicName}</div>
          {(() => {
            const deduplicationConfig = deduplicationStore.getDeduplication(index)
            return (
              deduplicationConfig && (
                <div className="ml-4 mt-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Deduplication:</span>{' '}
                    {deduplicationConfig.enabled ? 'Enabled' : 'Disabled'}
                  </div>
                  {deduplicationConfig.enabled && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Key Field:</span>{' '}
                        {deduplicationConfig.key || 'Not specified'}
                      </div>
                      {deduplicationConfig.window && (
                        <div>
                          <span className="text-muted-foreground">Time Window:</span> {deduplicationConfig.window}{' '}
                          {deduplicationConfig.unit || 'hours'}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            )
          })()}
        </li>
      )
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger
            value="overview"
            className="transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)]"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="json"
            className="transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)]"
          >
            JSON
          </TabsTrigger>
          <TabsTrigger
            value="yaml"
            className="transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)]"
          >
            YAML
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="p-4 border-b border-[var(--color-border-neutral-faded)] last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-fade-in-up animate-delay-100">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Kafka Connection</h3>
            <KafkaConnectionPreview kafkaStore={kafkaStore} />
          </div>

          <div className="p-4 border-b border-[var(--color-border-neutral-faded)] last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-fade-in-up animate-delay-200">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Selected Topics</h3>
            <ul className="list-disc list-inside">{renderTopics()}</ul>
          </div>

          {isFiltersEnabled() && filterStore?.filterConfig?.enabled && (
            <div className="p-4 border-b border-gray-200 last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-fade-in-up animate-delay-250">
              <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Filter</h3>
              <div className="text-sm text-content">
                <span className="text-muted-foreground">Expression: </span>
                <code className="bg-[var(--color-background-neutral)] px-1 rounded">
                  {filterStore.expressionString || '—'}
                </code>
              </div>
            </div>
          )}

          {isTransformationsEnabled() &&
            transformationStore?.transformationConfig?.enabled &&
            transformationStore.transformationConfig.fields?.length > 0 && (
              <div className="p-4 border-b border-gray-200 last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-fade-in-up animate-delay-275">
                <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Transformation</h3>
                <div className="text-sm text-content">
                  <div>
                    <span className="text-muted-foreground">Enabled: </span>
                    Yes
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fields: </span>
                    {transformationStore.transformationConfig.fields.length} configured
                  </div>
                </div>
              </div>
            )}

          <div className="p-4 border-b border-gray-200 last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-fade-in-up animate-delay-300">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Clickhouse Connection</h3>
            <ClickhouseConnectionPreview clickhouseConnection={clickhouseConnection} />
          </div>

          <div className="p-4 border-b border-[var(--color-border-neutral-faded)] last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-fade-in-up animate-delay-400">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Clickhouse Destination</h3>
            <ClickhouseDestinationPreview
              clickhouseDestination={clickhouseDestination}
              selectedTopics={selectedTopics}
            />
          </div>
        </TabsContent>

        <TabsContent value="json">
          <div className="p-4 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-fade-in-up animate-delay-100">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Configuration JSON</h3>
            <EditorWrapper mode="json" value={jsonContent} />
          </div>
        </TabsContent>

        <TabsContent value="yaml">
          <div className="p-4 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-fade-in-up animate-delay-100">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Configuration YAML</h3>
            <EditorWrapper mode="yaml" value={yamlContent} />
          </div>
        </TabsContent>

        <TabsContent value="api">
          <div className="p-4 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-fade-in-up animate-delay-100">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">API Configuration</h3>
            <p className="text-sm text-muted-foreground mb-4 transition-colors duration-200">
              This is the configuration in the format expected by the API.
            </p>
            <EditorWrapper mode="json" value={apiConfigContent} />
          </div>
        </TabsContent>
      </Tabs>

      {deployError && (
        <div
          className="mt-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-400 animate-fade-in-up"
          role="alert"
        >
          {deployError}
        </div>
      )}
      <div className="flex justify-start mt-4 animate-fade-in-up animate-delay-500">
        <Button
          variant="primary" size="custom" className="transition-all duration-200 hover:opacity-90"
          type="button"
          onClick={handleContinueToPipelines}
          disabled={!!configError}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
