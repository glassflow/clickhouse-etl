'use client'

import { useState, useEffect, useCallback } from 'react'
import PipelineDetailsHeader from './PipelineDetailsHeader'
import PipelineStatusOverviewSection from './PipelineStatusOverviewSection'
import TransformationSection from './sections/TransformationSection'
import StandaloneStepRenderer from '@/src/modules/pipelines/[id]/StandaloneStepRenderer'
import { StepKeys } from '@/src/config/constants'
import { Pipeline } from '@/src/types/pipeline'
import { useRouter } from 'next/navigation'
import { shouldDisablePipelineOperation } from '@/src/utils/pipeline-actions'
import { usePipelineOperations } from '@/src/hooks/usePipelineState'
import { useStore } from '@/src/store'
import { usePipelineActions } from '@/src/hooks/usePipelineActions'
import { getPipeline } from '@/src/api/pipeline-api'
import { cn } from '@/src/utils/common.client'
import { KafkaConnectionSection } from './sections/KafkaConnectionSection'
import { ClickhouseConnectionSection } from './sections/ClickhouseConnectionSection'

function PipelineDetailsModule({ pipeline: initialPipeline }: { pipeline: Pipeline }) {
  const router = useRouter()

  // local copy of the pipeline data - this is used to display the pipeline data in the UI along with its status
  const [pipeline, setPipeline] = useState<Pipeline>(initialPipeline)

  // active step - determines which step is currently being rendered in the standalone step renderer
  const [activeStep, setActiveStep] = useState<StepKeys | null>(null)

  // Animation states for sequential appearance
  const [showHeader, setShowHeader] = useState(false)
  const [showStatusOverview, setShowStatusOverview] = useState(false)
  const [showConfigurationSection, setShowConfigurationSection] = useState(false)

  // Use the centralized pipeline actions hook to get current pipeline actions status and transitions
  const { actionState } = usePipelineActions(pipeline)
  const operations = usePipelineOperations()

  // Get validation states from stores to display in the UI - these are used to disable the UI when the pipeline is not valid
  const kafkaValidation = useStore((state) => state.kafkaStore.validation)
  const clickhouseConnectionValidation = useStore((state) => state.clickhouseConnectionStore.validation)
  const clickhouseDestinationValidation = useStore((state) => state.clickhouseDestinationStore.validation)
  const joinValidation = useStore((state) => state.joinStore.validation)
  const topicsValidation = useStore((state) => state.topicsStore.validation)
  const deduplicationValidation = useStore((state) => state.deduplicationStore.validation)

  const { coreStore } = useStore()
  const { enterViewMode, mode } = coreStore

  // Determine if pipeline editing operations should be disabled
  // Consider both pipeline status AND if any action is currently loading
  const isEditingDisabled = shouldDisablePipelineOperation(pipeline.status) || actionState.isLoading

  // update the local copy of the pipeline data when the pipeline is updated
  const handlePipelineUpdate = (updatedPipeline: Pipeline) => {
    setPipeline(updatedPipeline)
  }

  // Function to refresh pipeline data from the server
  const refreshPipelineData = useCallback(async () => {
    try {
      const updatedPipeline = await getPipeline(pipeline.pipeline_id)
      setPipeline(updatedPipeline)
    } catch (error) {
      console.error('Failed to refresh pipeline data:', error)
    }
  }, [pipeline.pipeline_id, pipeline.status])

  // Hydrate the pipeline data when the pipeline configuration is loaded
  useEffect(() => {
    const hydrateData = async () => {
      // CRITICAL: Don't hydrate if there are unsaved changes or if we're in edit mode
      // This prevents overwriting user changes with stale backend data
      // We check the current state directly instead of using it as a dependency
      const { coreStore: currentCoreStore } = useStore.getState()

      if (currentCoreStore.isDirty) {
        console.log('[PipelineDetailsModule] Skipping hydration - dirty config present')
        return
      }

      if (pipeline && pipeline?.source && pipeline?.sink && actionState.isLoading === false && mode !== 'edit') {
        // Create a cache key that includes the pipeline configuration to detect changes
        // This ensures re-hydration when the pipeline is edited
        const topicNames = pipeline.source?.topics?.map((t: any) => t.name).join(',') || ''
        const currentPipelineKey = `${pipeline.pipeline_id}-${pipeline.name}-${topicNames}`
        const lastHydratedKey = sessionStorage.getItem('lastHydratedPipeline')

        // CRITICAL: Check if cache says we're hydrated, but also verify stores actually have data
        // After a page reload, sessionStorage persists but Zustand stores are empty
        if (lastHydratedKey === currentPipelineKey) {
          // Verify that stores actually have data before skipping hydration
          const { topicsStore } = useStore.getState()
          const hasTopics = topicsStore.topics && Object.keys(topicsStore.topics).length > 0

          if (hasTopics) {
            return
          } else {
            // Clear the stale cache and proceed with hydration
            sessionStorage.removeItem('lastHydratedPipeline')
          }
        }

        console.log('[PipelineDetailsModule] Hydrating pipeline:', currentPipelineKey)

        try {
          // pipeline hydration is handled by the enterViewMode function from the core store
          await enterViewMode(pipeline)
          // Mark as hydrated to prevent re-hydration - this is used to prevent infinite loop
          sessionStorage.setItem('lastHydratedPipeline', currentPipelineKey)
        } catch (error) {
          console.error('Failed to hydrate pipeline data:', error) // The error will be handled by the stores' validation states
        }
      }
    }

    hydrateData()
    // NOTE: We intentionally don't include actionState.lastAction in dependencies
    // to prevent re-hydration on every action completion (stop, resume, etc.)
    // The sessionStorage cache and topicNames in the key handle detecting real config changes
    // We check isDirty directly in the function rather than as a dependency to avoid loops
  }, [pipeline, enterViewMode, mode, actionState.isLoading])

  // Sequential animation effect - show sections one by one
  useEffect(() => {
    // Start the animation sequence
    setShowHeader(true)

    const statusTimer = setTimeout(() => {
      setShowStatusOverview(true)
    }, 500) // 300ms delay for status overview

    const configTimer = setTimeout(() => {
      setShowConfigurationSection(true)
    }, 1000) // 600ms delay for configuration section

    return () => {
      clearTimeout(statusTimer)
      clearTimeout(configTimer)
    }
  }, []) // Run once on mount

  // Handle action completion - use centralized system for status tracking
  useEffect(() => {
    if (!actionState.isLoading && actionState.lastAction) {
      if (actionState.lastAction === 'stop') {
        // For stop operations, report to centralized system
        operations.reportStop(pipeline.pipeline_id)
      } else if (actionState.lastAction === 'resume') {
        operations.reportResume(pipeline.pipeline_id)
      } else if (actionState.lastAction === 'terminate') {
        operations.reportTerminate(pipeline.pipeline_id)
      } else {
        // For other actions, use the regular refresh with delay
        const timer = setTimeout(() => {
          refreshPipelineData()
        }, 500)

        return () => clearTimeout(timer)
      }
    }
  }, [actionState.isLoading, actionState.lastAction, pipeline.pipeline_id, refreshPipelineData, operations])

  // set active step so that the standalone step renderer can be rendered
  const handleStepClick = (step: StepKeys) => {
    // Prevent step clicks when editing is disabled
    if (isEditingDisabled) {
      return
    }

    setActiveStep(step)
  }

  // close the standalone step renderer
  const handleCloseStep = () => {
    setActiveStep(null)
  }

  // redirect to pipelines list after deletion
  const handlePipelineDeleted = () => {
    // Redirect to pipelines list after deletion
    router.push('/pipelines')
  }

  // NOTE: this is used to update the pipeline status in the UI when the pipeline is stopped or resumed
  // it happens when pp is active and we want to edit one of the sections - for that we need to update the status
  // in the UI so that the pipeline actions hook can determine if the pipeline is valid
  const handlePipelineStatusUpdate = (status: string) => {
    setPipeline((prev) => ({
      ...prev,
      status: status as Pipeline['status'],
    }))
  }

  // Section selection highlighting
  const SOURCE_STEPS = new Set<StepKeys>([StepKeys.KAFKA_CONNECTION])
  const TRANSFORMATION_STEPS = new Set<StepKeys>([
    StepKeys.TOPIC_SELECTION_1,
    StepKeys.TOPIC_SELECTION_2,
    StepKeys.DEDUPLICATION_CONFIGURATOR,
    StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
    StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
    StepKeys.JOIN_CONFIGURATOR,
    StepKeys.CLICKHOUSE_MAPPER,
  ])
  const SINK_STEPS = new Set<StepKeys>([StepKeys.CLICKHOUSE_CONNECTION])

  const isSourceSelected = activeStep ? SOURCE_STEPS.has(activeStep) : false
  const isSinkSelected = activeStep ? SINK_STEPS.has(activeStep) : false

  return (
    <div>
      {/* Header Section - Appears first */}
      <PipelineDetailsHeader
        pipeline={pipeline}
        onPipelineUpdate={handlePipelineUpdate}
        onPipelineDeleted={handlePipelineDeleted}
        showHeader={showHeader}
      />

      {/* Status Overview Section - Appears second */}
      <PipelineStatusOverviewSection pipeline={pipeline} showStatusOverview={showStatusOverview} />

      {/* Configuration Section - Appears third */}
      <div
        className={cn(
          'flex flex-row gap-4 items-stretch transition-all duration-750 ease-out',
          showConfigurationSection ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}
      >
        <KafkaConnectionSection
          disabled={isEditingDisabled}
          selected={isSourceSelected}
          onStepClick={handleStepClick}
        />
        <TransformationSection
          pipeline={pipeline}
          onStepClick={handleStepClick}
          disabled={isEditingDisabled}
          validation={{
            kafkaValidation: kafkaValidation,
            topicsValidation: topicsValidation,
            joinValidation: joinValidation,
            deduplicationValidation: deduplicationValidation,
            clickhouseConnectionValidation: clickhouseConnectionValidation,
            clickhouseDestinationValidation: clickhouseDestinationValidation,
          }}
          activeStep={activeStep}
        />
        <ClickhouseConnectionSection
          disabled={isEditingDisabled}
          selected={isSinkSelected}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Render the standalone step renderer when a step is active */}
      {activeStep && (
        <StandaloneStepRenderer
          stepKey={activeStep}
          onClose={handleCloseStep}
          pipeline={pipeline}
          onPipelineStatusUpdate={handlePipelineStatusUpdate}
        />
      )}
    </div>
  )
}

export default PipelineDetailsModule
