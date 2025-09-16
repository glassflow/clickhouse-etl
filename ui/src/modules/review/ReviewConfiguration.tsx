'use client'

import React, { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { StepKeys } from '@/src/config/constants'
import { Button } from '@/src/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import yaml from 'js-yaml'
import { useRouter } from 'next/navigation'
import { generateApiConfig } from '../clickhouse/utils'
import { ReviewConfigurationProps } from './types'
import { ClickhouseDestinationPreview } from './ClickhouseDestinationPreview'
import { ClickhouseConnectionPreview } from './ClickhouseConnectionPreview'
import { KafkaConnectionPreview } from './KafkaConnectionPreview'
import { EditorWrapper } from './EditorWrapper'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { createPipeline } from '@/src/api/pipeline-api'
import { Pipeline } from '@/src/types/pipeline'

export function ReviewConfiguration({ steps, onCompleteStep, validate }: ReviewConfigurationProps) {
  const {
    kafkaStore,
    clickhouseConnectionStore,
    clickhouseDestinationStore,
    topicsStore,
    joinStore,
    coreStore,
    deduplicationStore,
  } = useStore()
  const { apiConfig, pipelineId, setPipelineId, operationsSelected } = coreStore
  const { clickhouseConnection } = clickhouseConnectionStore
  const { clickhouseDestination } = clickhouseDestinationStore
  const router = useRouter()
  const selectedTopics = Object.values(topicsStore.topics || {})
  const analytics = useJourneyAnalytics()

  const [activeTab, setActiveTab] = useState('overview')
  const [jsonContent, setJsonContent] = useState('')
  const [yamlContent, setYamlContent] = useState('')
  const [apiConfigContent, setApiConfigContent] = useState('')

  const getMappingType = (eventField: string, mapping: any) => {
    const mappingEntry = mapping.find((m: any) => m.eventField === eventField)

    if (mappingEntry) {
      return mappingEntry.jsonType
    }

    // NOTE: default to string if no mapping entry is found - check this
    return 'string'
  }

  // Update the content when relevant store data changes
  useEffect(() => {
    setJsonContent(JSON.stringify(apiConfig, null, 2))
    setYamlContent(yaml.dump(apiConfig, { indent: 2 }))
    setApiConfigContent(JSON.stringify(apiConfig, null, 2))
  }, [kafkaStore, clickhouseConnection, clickhouseDestination, selectedTopics])

  const handleContinueToPipelines = async () => {
    if (validate && !validate(StepKeys.REVIEW_CONFIGURATION, {})) {
      return
    }

    try {
      // Deploy the pipeline immediately
      const response = await createPipeline(apiConfig as Partial<Pipeline>)

      // Set the pipeline ID from the response
      const newPipelineId = apiConfig?.pipeline_id || ''
      setPipelineId(newPipelineId)

      // Navigate to pipelines page to show deployment status
      router.push('/pipelines')
    } catch (error: any) {
      console.error('Failed to deploy pipeline:', error)
      // You might want to show an error message to the user here
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
        <TabsList className="grid grid-cols-4 mb-4">
          {/* <TabsTrigger
            value="api"
            className="transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)]"
          >
            API Config
          </TabsTrigger> */}
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
          {/* <TabsTrigger
            value="overview"
            className="transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)]"
          >
            Overview
          </TabsTrigger> */}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="p-4 border-b border-gray-200 last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-fade-in-up animate-delay-100">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Kafka Connection</h3>
            <KafkaConnectionPreview kafkaStore={kafkaStore} />
          </div>

          <div className="p-4 border-b border-gray-200 last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-fade-in-up animate-delay-200">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Selected Topics</h3>
            <ul className="list-disc list-inside">{renderTopics()}</ul>
          </div>

          <div className="p-4 border-b border-gray-200 last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-fade-in-up animate-delay-300">
            <h3 className="text-lg font-medium mb-2 transition-colors duration-200">Clickhouse Connection</h3>
            <ClickhouseConnectionPreview clickhouseConnection={clickhouseConnection} />
          </div>

          <div className="p-4 border-b border-gray-200 last:border-b-0 transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)] animate-fade-in-up animate-delay-400">
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

      <div className="flex justify-start mt-4 animate-fade-in-up animate-delay-500">
        <Button
          className="btn-primary transition-all duration-200 hover:opacity-90"
          type="button"
          variant="gradient"
          size="custom"
          onClick={handleContinueToPipelines}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
