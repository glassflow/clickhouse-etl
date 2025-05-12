'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useStore } from '@/src/store'
import { StepKeys } from '@/src/config/constants'
import { Button } from '@/src/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import dynamic from 'next/dynamic'
import yaml from 'js-yaml'
import { useRouter } from 'next/navigation'
import { InputModal, ModalResult } from '@/src/components/shared/InputModal'
import { saveConfiguration } from '@/src/utils/storage'
import { useAnalytics } from '@/src/hooks/useAnalytics'
import { generateApiConfig } from './helpers'
import { ReviewConfigurationProps } from './types'
import { ClickhouseDestinationPreview } from './ClickhouseDestinationPreview'
import { ClickhouseConnectionPreview } from './ClickhouseConnectionPreview'
import { KafkaConnectionPreview } from './KafkaConnectionPreview'
import { EditorWrapper } from './EditorWrapper'

// NOTE: temp hack - disable saving pipelines but leave the logic in place
const SAVE_PIPELINE_ENABLED = false

export function ReviewConfiguration({ steps, onNext, validate }: ReviewConfigurationProps) {
  const { kafkaStore, clickhouseStore, topicsStore, joinStore, setApiConfig, pipelineId, setPipelineId } = useStore()
  const { clickhouseConnection, clickhouseDestination } = clickhouseStore
  const { bootstrapServers, securityProtocol } = kafkaStore
  const router = useRouter()
  const selectedTopics = Object.values(topicsStore.topics || {})
  const { trackFunnelStep, trackPageView } = useAnalytics()

  // Add state for the modal
  const [isDeployModalVisible, setIsDeployModalVisible] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [jsonContent, setJsonContent] = useState('')
  const [yamlContent, setYamlContent] = useState('')
  const [apiConfigContent, setApiConfigContent] = useState('')

  // Track page view when component loads
  useEffect(() => {
    trackPageView('pipelines', {
      referer: document.referrer,
      timestamp: new Date().toISOString(),
      step: 'review',
    })
  }, [trackPageView])

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
    const config = generateApiConfig({
      pipelineId,
      setPipelineId,
      clickhouseConnection,
      clickhouseDestination,
      selectedTopics,
      getMappingType,
      joinStore,
      kafkaStore,
    })
    setJsonContent(JSON.stringify(config, null, 2))
    setYamlContent(yaml.dump(config, { indent: 2 }))
    setApiConfigContent(JSON.stringify(config, null, 2))
  }, [kafkaStore, clickhouseConnection, clickhouseDestination, selectedTopics])

  const handleFinishDeploymentStep = () => {
    // Track the deploy button click event
    trackFunnelStep('deployClicked', {
      pipelineId,
      kafkaTopicsCount: selectedTopics.length,
      clickhouseTable: clickhouseDestination?.table,
      clickhouseDatabase: clickhouseDestination?.database,
    })

    if (validate && !validate(StepKeys.REVIEW_CONFIGURATION, {})) {
      return
    }

    if (SAVE_PIPELINE_ENABLED) {
      setIsDeployModalVisible(true)
    } else {
      handleDeployPipeline(ModalResult.SUBMIT, 'Pipeline', 'deploy')
    }
  }

  const handleDeployPipeline = (result: string, configName: string, operation: string) => {
    if (SAVE_PIPELINE_ENABLED) {
      setIsDeployModalVisible(false)

      // Save configuration to local storage if name is provided
      if (configName) {
        try {
          const savedConfig = saveConfiguration(
            configName,
            `Pipeline configuration saved on ${new Date().toLocaleString()}`,
          )
        } catch (error) {
          console.error('Failed to save configuration:', error)
          // You might want to show an error message to the user here
        }
      }
    }

    if (result === ModalResult.SUBMIT) {
      // Generate and set the API config before moving to the next step
      const config = generateApiConfig({
        pipelineId,
        setPipelineId,
        clickhouseConnection,
        clickhouseDestination,
        selectedTopics,
        getMappingType,
        joinStore,
        kafkaStore,
      })
      setApiConfig(config)

      // Navigate to the pipelines page
      router.push('/pipelines')
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
          {topic?.deduplication && (
            <div className="ml-4 mt-2 text-sm">
              <div>
                <span className="text-muted-foreground">Deduplication:</span>{' '}
                {topic.deduplication.enabled ? 'Enabled' : 'Disabled'}
              </div>
              {topic.deduplication.enabled && (
                <>
                  <div>
                    <span className="text-muted-foreground">Method:</span>{' '}
                    {topic.deduplication.method === 'key' ? 'Key-based' : 'Hash-based'}
                  </div>
                  {topic.deduplication.method === 'key' && (
                    <div>
                      <span className="text-muted-foreground">Key Field:</span>{' '}
                      {topic.deduplication.keyField || 'Not specified'}
                    </div>
                  )}
                  {topic.deduplication.window && (
                    <div>
                      <span className="text-muted-foreground">Time Window:</span> {topic.deduplication.window}{' '}
                      {topic.deduplication.windowUnit || 'seconds'}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </li>
      )
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-4">
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
          <TabsTrigger
            value="api"
            className="transition-all duration-200 hover:bg-[var(--color-background-neutral-faded)]"
          >
            API Config
          </TabsTrigger>
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
          onClick={handleFinishDeploymentStep}
        >
          Deploy Pipeline
        </Button>
      </div>

      <InputModal
        visible={isDeployModalVisible}
        title="Deploy Pipeline"
        description="You can optionally save this configuration for future use."
        inputLabel="Configuration Name"
        inputPlaceholder="e.g., Production Pipeline v1"
        submitButtonText="Deploy"
        cancelButtonText="Cancel"
        onComplete={handleDeployPipeline}
        pendingOperation="deploy_pipeline"
        initialValue=""
        showSaveOption={true}
        validation={(value) => {
          if (!value.trim()) {
            return 'Configuration name is required'
          }
          if (value.length < 3) {
            return 'Configuration name must be at least 3 characters long'
          }
          return null
        }}
      />
    </div>
  )
}
