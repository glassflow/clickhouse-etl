'use client'

import Image from 'next/image'
import { structuredLogger } from '@/src/observability'
import Join from '../../images/join.svg'
import IngestOnly from '../../images/ingest-only.svg'
import KafkaIcon from '../../images/kafka.svg'
import { ArrowUpTrayIcon, SignalIcon, DocumentTextIcon, MapIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { SourceType } from '@/src/config/source-types'
import { useStore } from '@/src/store'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/src/utils/common.client'
import { Card } from '@/src/components/ui/card'
import { useState, useEffect } from 'react'
import CreatePipelineModal from '@/src/components/home/CreatePipelineModal'
import { UploadPipelineModal } from '@/src/components/home/UploadPipelineModal'
import { InfoModal, ModalResult } from '@/src/components/common/InfoModal'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { generatePipelineId } from '@/src/utils/common.client'
import { usePlatformDetection } from '@/src/hooks/usePlatformDetection'
import { getPipelines } from '@/src/api/pipeline-api'
import { countPipelinesBlockingCreation } from '@/src/utils/pipeline-actions'
import { markStoresValidAfterImport } from '@/src/utils/pipeline-import'
import type { Pipeline } from '@/src/types/pipeline'

function OrSeparator() {
  return (
    <div className="flex items-center gap-4 w-full" role="presentation" aria-hidden="true">
      {/* 
        The issue is likely that `bg-[card-border]` is not a valid Tailwind or custom utility class.
        Tailwind's arbitrary value syntax (bg-[...]) expects a valid color value, but "card-border" is a CSS custom property token.
        To use a CSS variable as a background or border color in Tailwind with arbitrary value, you must prefix with "var(--token-name)".
        For a border: use border instead of bg, and set border color via border-[var(--card-border)].
      */}
      <span
        className="flex-1 h-[1px] shrink-0 border-t border-[var(--card-border)] bg-transparent"
        aria-hidden="true"
      />
      <span className="text-xs sm:text-sm text-muted-foreground font-medium uppercase tracking-wider shrink-0">Or</span>
      <span
        className="flex-1 h-[1px] shrink-0 border-t border-[var(--card-border)] bg-transparent"
        aria-hidden="true"
      />
    </div>
  )
}

// Client Component for handling searchParams
export default function HomePageClient() {
  const store = useStore()
  const { topicsStore, kafkaStore, joinStore, coreStore, otlpStore, resetForNewPipeline, resetAllPipelineState } = store
  const analytics = useJourneyAnalytics()
  const searchParams = useSearchParams()
  const showWarning = searchParams?.get('showWarning') === 'true'
  const fromPath = searchParams?.get('from')
  const [showWarningModal, setShowWarningModal] = useState(showWarning)
  const router = useRouter()
  const [pendingTopicCount, setPendingTopicCount] = useState<number | null>(null)
  const [isCreatePipelineModalVisible, setIsCreatePipelineModalVisible] = useState(false)
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const [activePipelinesCount, setActivePipelinesCount] = useState(0)
  const [showPipelineLimitModal, setShowPipelineLimitModal] = useState(false)
  const [selectedSource, setSelectedSource] = useState<'kafka' | 'otlp' | null>(null)
  const [selectedOtlpSignal, setSelectedOtlpSignal] = useState<SourceType | null>(null)
  const { setPipelineName, setPipelineId, topicCount, enterCreateMode, hydrateFromConfig, setSourceType } = coreStore
  const { isDocker, isLocal } = usePlatformDetection()

  // by default enter create mode as soon as the component loads
  useEffect(() => {
    enterCreateMode()
  }, [enterCreateMode])

  // Fetch active pipelines count for platform limitation check
  useEffect(() => {
    const fetchActivePipelines = async () => {
      try {
        const pipelines = await getPipelines()
        // Count pipelines that are active or paused as blocking new pipeline creation
        // Only terminated or deleted pipelines allow new pipeline creation
        const blockingCount = countPipelinesBlockingCreation(pipelines)
        setActivePipelinesCount(blockingCount)
      } catch (error) {
        structuredLogger.error('HomePageClient failed to fetch pipelines', { error: error instanceof Error ? error.message : String(error) })
        setActivePipelinesCount(0)
      }
    }

    // Only fetch if we're on a platform that has limitations
    if (isDocker || isLocal) {
      fetchActivePipelines()
    }
  }, [isDocker, isLocal])

  // Track page view when component loads
  useEffect(() => {
    analytics.page.homepage({
      referrer: fromPath || document.referrer,
      timestamp: new Date().toISOString(),
    })
  }, [analytics.page, fromPath])

  const handleTopicCountClick = (count: 1 | 2) => {
    // Check if we're on a platform with limitations and there are active pipelines
    if ((isDocker || isLocal) && activePipelinesCount > 0) {
      setShowPipelineLimitModal(true)
      return
    }

    // Track topic count selection analytics
    analytics.operation.ingestOnly({
      operationType: count === 1 ? 'single-topic' : 'two-topics',
    })

    setPendingTopicCount(count)
    setIsCreatePipelineModalVisible(true)
    setIsNavigating(false) // Reset navigation state when opening modal
  }

  const handleOtlpSignalClick = (signal: SourceType) => {
    if ((isDocker || isLocal) && activePipelinesCount > 0) {
      setShowPipelineLimitModal(true)
      return
    }
    setSelectedOtlpSignal(signal)
    setPendingTopicCount(1)
    setIsCreatePipelineModalVisible(true)
    setIsNavigating(false)
  }

  const handleWarningModalComplete = (result: string) => {
    setShowWarningModal(false)

    if (result === ModalResult.YES) {
      // Reset pipeline state and stay on home page
      resetAllPipelineState(0, true)
    } else {
      // Go back to previous page
      router.push(fromPath || '/')
    }
  }

  const handlePipelineLimitModalComplete = (result: string) => {
    setShowPipelineLimitModal(false)

    if (result === ModalResult.YES) {
      // Navigate to pipelines page to manage active pipelines
      router.push('/pipelines')
    }
  }

  const completeTopicCountSelection = async (topicCount: number, configName: string, pipelineId?: string) => {
    setIsNavigating(true)

    try {
      // Use the optimized reset method for new pipeline creation
      resetForNewPipeline(topicCount)
      setPipelineName(configName)

      // Use provided pipeline ID or generate one
      const finalPipelineId = pipelineId || generatePipelineId(configName)
      setPipelineId(finalPipelineId)

      // Set source type based on selection
      if (selectedSource === 'otlp' && selectedOtlpSignal) {
        setSourceType(selectedOtlpSignal)
        // Initialize the OTLP store with signal type (populates schemaFields) and
        // source ID. These must be set AFTER resetForNewPipeline which clears them.
        otlpStore.setSignalType(selectedOtlpSignal)
        otlpStore.setSourceId(`${finalPipelineId}-source`)
      } else {
        setSourceType(SourceType.KAFKA)
      }

      // Use setTimeout to ensure state updates are processed before navigation
      setTimeout(() => {
        router.push('/pipelines/create')
      }, 0)
    } catch (error) {
      setIsNavigating(false)
      structuredLogger.error('HomePageClient failed to complete topic count selection', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  const handleCreatePipelineModalComplete = async (result: string, configName?: string, pipelineId?: string) => {
    // Don't close modal immediately if we're proceeding with creation
    if (result !== ModalResult.YES) {
      setIsCreatePipelineModalVisible(false)
      setIsNavigating(false)
      return
    }

    // Save configuration if the user chose to do so and provided a name
    if (result === ModalResult.YES && configName && pendingTopicCount) {
      try {
        // Keep modal open while navigating
        await completeTopicCountSelection(pendingTopicCount, configName, pipelineId)
        // Modal will be closed when component unmounts due to navigation
      } catch (error) {
        structuredLogger.error('HomePageClient failed to save configuration', { error: error instanceof Error ? error.message : String(error) })
        setIsCreatePipelineModalVisible(false)
        setIsNavigating(false)
      }
    }
  }

  const handleUploadClick = () => {
    // Check if we're on a platform with limitations and there are active pipelines
    if ((isDocker || isLocal) && activePipelinesCount > 0) {
      setShowPipelineLimitModal(true)
      return
    }

    // Track upload selection analytics
    analytics.operation.ingestOnly({
      operationType: 'import-config',
    })

    setIsUploadModalVisible(true)
    setIsNavigating(false)
  }

  const handleUploadModalComplete = async (result: string, config?: Pipeline) => {
    if (result !== ModalResult.YES || !config) {
      setUploadError(null)
      setIsUploadModalVisible(false)
      setIsNavigating(false)
      return
    }

    setUploadError(null)
    setIsNavigating(true)

    try {
      const importedTopicCount = config.source?.topics?.length || 1

      // Reset pipeline state for the imported configuration
      resetForNewPipeline(importedTopicCount)

      // Set pipeline name from imported config
      const pipelineName = config.name || 'Imported Pipeline'
      setPipelineName(pipelineName)

      // Generate a new pipeline ID for the imported configuration
      const newPipelineId = generatePipelineId(pipelineName)
      setPipelineId(newPipelineId)

      // Hydrate from imported config without pipeline_id so resources hydration does not
      // fetch by the exported pipeline_id and overwrite uploaded pipeline_resources (e.g. sink replicas)
      await hydrateFromConfig({ ...config, pipeline_id: undefined })

      // Mark stores as valid after successful hydration
      // This ensures the wizard shows steps as completed when data is present
      markStoresValidAfterImport(store, config)

      // Navigate to the wizard
      setTimeout(() => {
        router.push('/pipelines/create')
      }, 0)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import pipeline configuration'
      structuredLogger.error('HomePageClient failed to import pipeline configuration', { error: error instanceof Error ? error.message : String(error) })
      setUploadError(message)
      setIsNavigating(false)
      // Keep modal open so the user can fix the configuration or try again
    }
  }

  return (
    <div className="grow flex-col items-start gap-6 sm:gap-8 container mx-auto px-4 sm:px-0 py-8 sm:py-12">
      <div className="flex flex-col items-start gap-3 sm:gap-3 w-full px-4 sm:px-0 pt-6 pb-4">
        <h1 className="title-1 text-start">Create Pipeline</h1>
        <h2 className="w-full text-start subtitle muted-foreground text-xs sm:text-sm">
          Create a new pipeline or import a prepared configuration
        </h2>
      </div>
      <div className="flex flex-col gap-8 sm:gap-10 mt-4 sm:mt-6 w-full max-w-[960px]">
        {/* Section 1: Choose your data source */}
        <section className="flex flex-col gap-3 sm:gap-4 w-full" aria-labelledby="section-source-heading">
          <h2 id="section-source-heading" className="subtitle-2 text-content text-xs sm:text-sm font-medium mb-3">
            Choose your data source
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
            <Card variant="selectable" className={cn(selectedSource === 'kafka' && 'active', 'h-16 sm:h-20 lg:h-24 w-full !p-0')}>
              <button
                className="flex items-center justify-center px-4 sm:px-6 w-full h-full cursor-pointer"
                onClick={() => { setSelectedSource('kafka'); setSelectedOtlpSignal(null) }}
              >
                <Image src={KafkaIcon} alt="Kafka" width={24} height={24} className="sm:w-9 sm:h-9" />
                <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">
                  Kafka
                </span>
              </button>
            </Card>
            <Card variant="selectable" className={cn(selectedSource === 'otlp' && 'active', 'h-16 sm:h-20 lg:h-24 w-full !p-0')}>
              <button
                className="flex items-center justify-center px-4 sm:px-6 w-full h-full cursor-pointer"
                onClick={() => { setSelectedSource('otlp'); setSelectedOtlpSignal(null) }}
              >
                <SignalIcon className="w-6 h-6 sm:w-9 sm:h-9 text-[var(--color-foreground-neutral-faded)]" />
                <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">
                  OpenTelemetry (OTLP)
                </span>
              </button>
            </Card>
          </div>
        </section>

        {/* Section 2a: Kafka — Configure with wizard (topic count) */}
        {selectedSource === 'kafka' && (
          <section className="flex flex-col gap-3 sm:gap-4 w-full animate-fadeIn" aria-labelledby="section-wizard-heading">
            <h2 id="section-wizard-heading" className="subtitle-2 text-content text-xs sm:text-sm font-medium mb-3">
              Configure with wizard
            </h2>
            <p className="subtitle-3 text-xs sm:text-sm -mt-1">
              Choose a pipeline type based on the number of streams you want to ingest
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
              <Card variant="selectable" className={cn(topicCount === 1 && 'active', 'h-16 sm:h-20 lg:h-24 w-full !p-0')}>
                <button
                  className="flex items-center justify-center px-4 sm:px-6 w-full h-full cursor-pointer"
                  onClick={() => handleTopicCountClick(1)}
                >
                  <Image src={IngestOnly} alt="Ingest Only" width={24} height={24} className="sm:w-9 sm:h-9" />
                  <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-[var(--color-foreground-neutral)]">
                    Single-Topic Pipeline
                  </span>
                </button>
              </Card>
              <Card variant="selectable" className={cn(topicCount === 2 && 'active', 'h-16 sm:h-20 lg:h-24 w-full !p-0')}>
                <button
                  className="flex items-center justify-center px-4 sm:px-6 w-full h-full cursor-pointer"
                  onClick={() => handleTopicCountClick(2)}
                >
                  <Image src={Join} alt="Join" width={24} height={24} className="sm:w-9 sm:h-9" />
                  <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-[var(--color-foreground-neutral)]">
                    Multi-Topic Pipeline
                  </span>
                </button>
              </Card>
            </div>
          </section>
        )}

        {/* Section 2b: OTLP — Select signal type */}
        {selectedSource === 'otlp' && (
          <section className="flex flex-col gap-3 sm:gap-4 w-full animate-fadeIn" aria-labelledby="section-signal-heading">
            <h2 id="section-signal-heading" className="subtitle-2 text-content text-xs sm:text-sm font-medium mb-3">
              Select signal type
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full">
              <Card variant="selectable" className={cn(selectedOtlpSignal === SourceType.OTLP_LOGS && 'active', 'h-16 sm:h-20 lg:h-24 w-full !p-0')}>
                <button
                  className="flex items-center justify-center px-4 sm:px-6 w-full h-full cursor-pointer"
                  onClick={() => handleOtlpSignalClick(SourceType.OTLP_LOGS)}
                >
                  <DocumentTextIcon className="w-6 h-6 sm:w-9 sm:h-9 text-[var(--color-foreground-neutral-faded)]" />
                  <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-[var(--color-foreground-neutral)]">
                    Logs
                  </span>
                </button>
              </Card>
              <Card variant="selectable" className={cn(selectedOtlpSignal === SourceType.OTLP_TRACES && 'active', 'h-16 sm:h-20 lg:h-24 w-full !p-0')}>
                <button
                  className="flex items-center justify-center px-4 sm:px-6 w-full h-full cursor-pointer"
                  onClick={() => handleOtlpSignalClick(SourceType.OTLP_TRACES)}
                >
                  <MapIcon className="w-6 h-6 sm:w-9 sm:h-9 text-[var(--color-foreground-neutral-faded)]" />
                  <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-[var(--color-foreground-neutral)]">
                    Traces
                  </span>
                </button>
              </Card>
              <Card variant="selectable" className={cn(selectedOtlpSignal === SourceType.OTLP_METRICS && 'active', 'h-16 sm:h-20 lg:h-24 w-full !p-0')}>
                <button
                  className="flex items-center justify-center px-4 sm:px-6 w-full h-full cursor-pointer"
                  onClick={() => handleOtlpSignalClick(SourceType.OTLP_METRICS)}
                >
                  <ChartBarIcon className="w-6 h-6 sm:w-9 sm:h-9 text-[var(--color-foreground-neutral-faded)]" />
                  <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-[var(--color-foreground-neutral)]">
                    Metrics
                  </span>
                </button>
              </Card>
            </div>
          </section>
        )}

        <OrSeparator />

        {/* Section 2: Import configuration */}
        <section className="flex flex-col gap-3 sm:gap-4 w-full" aria-labelledby="section-import-heading">
          <h2 id="section-import-heading" className="subtitle-2 text-content text-xs sm:text-sm font-medium mb-3">
            Import configuration
          </h2>
          <p className="subtitle-3 text-xs sm:text-sm -mt-1">
            Import a prepared pipeline configuration from a file or paste it directly
          </p>
          <Card variant="selectable" className="h-16 sm:h-20 lg:h-24 w-full max-w-md !p-0">
            <button className="flex items-center justify-center px-4 sm:px-6 w-full h-full cursor-pointer" onClick={handleUploadClick}>
              <ArrowUpTrayIcon className="w-6 h-6 sm:w-9 sm:h-9 text-[var(--color-orange-300)]" />
              <span className="ml-3 sm:ml-4 text-sm sm:text-lg font-medium text-muted-foreground">
                Import Configuration
              </span>
            </button>
          </Card>
        </section>

        {/* <OrSeparator /> */}

        {/* Section 3: Configure with AI assistant (placeholder for future) */}
        {/* <section className="flex flex-col gap-3 sm:gap-4 w-full" aria-labelledby="section-ai-heading">
          <h2 id="section-ai-heading" className="subtitle-2 text-content text-xs sm:text-sm font-medium mb-3">
            Configure with AI assistant
          </h2>
          <p className="subtitle-3 text-muted-foreground text-xs sm:text-sm -mt-1">
            Use the AI assistant to configure your pipeline
          </p>
          <div
            className={cn(
              'btn-card opacity-60 cursor-not-allowed h-16 sm:h-20 lg:h-24 w-full max-w-md',
              'border-dashed',
            )}
            aria-hidden
          >
            <div className="flex items-center justify-center px-4 sm:px-6 w-full h-full pointer-events-none">
              <span className="text-sm sm:text-lg font-medium text-muted-foreground">Coming soon</span>
            </div>
          </div>
        </section> */}
      </div>

      <InfoModal
        visible={showWarningModal}
        title="Warning"
        description="Returning to the home page will reset your current pipeline configuration. Are you sure you want to proceed?"
        okButtonText="Yes"
        cancelButtonText="No"
        onComplete={handleWarningModalComplete}
      />

      <InfoModal
        visible={showPipelineLimitModal}
        title="Pipeline Limit Reached"
        description={`Only one active pipeline is allowed on ${isDocker ? 'Docker' : 'Local'} version. To create a new pipeline, you must first terminate or delete any currently active or paused pipelines.`}
        okButtonText="Manage Pipelines"
        cancelButtonText="Cancel"
        onComplete={handlePipelineLimitModalComplete}
      />

      <CreatePipelineModal
        visible={isCreatePipelineModalVisible}
        onComplete={handleCreatePipelineModalComplete}
        isNavigating={isNavigating}
      />

      <UploadPipelineModal
        visible={isUploadModalVisible}
        onComplete={handleUploadModalComplete}
        isNavigating={isNavigating}
        importError={uploadError}
        onClearImportError={() => setUploadError(null)}
      />
    </div>
  )
}
