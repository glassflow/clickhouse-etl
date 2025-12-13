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
import { getPipeline, updatePipelineMetadata } from '@/src/api/pipeline-api'
import { cn, isDemoMode } from '@/src/utils/common.client'
import { KafkaConnectionSection } from './sections/KafkaConnectionSection'
import { ClickhouseConnectionSection } from './sections/ClickhouseConnectionSection'
import PipelineTagsModal from '@/src/modules/pipelines/components/PipelineTagsModal'
import { handleApiError } from '@/src/notifications/api-error-handler'
import { notify } from '@/src/notifications'
import { PipelineDetailsSidebar, SidebarSection, getSidebarItems } from './PipelineDetailsSidebar'
import { getPipelineAdapter } from '@/src/modules/pipeline-adapters/factory'

function PipelineDetailsModule({ pipeline: initialPipeline }: { pipeline: Pipeline }) {
  const router = useRouter()

  // local copy of the pipeline data - this is used to display the pipeline data in the UI along with its status
  const [pipeline, setPipeline] = useState<Pipeline>(initialPipeline)

  // active step - determines which step is currently being rendered in the standalone step renderer
  const [activeStep, setActiveStep] = useState<StepKeys | null>(null)

  // Active topic index - for multi-topic deduplication (0 = left, 1 = right)
  const [activeTopicIndex, setActiveTopicIndex] = useState<number>(0)

  // Active sidebar section - determines which section is highlighted in the sidebar
  const [activeSection, setActiveSection] = useState<SidebarSection | null>('monitor')

  // Animation states for sequential appearance
  const [showHeader, setShowHeader] = useState(false)
  const [showStatusOverview, setShowStatusOverview] = useState(false)
  const [showConfigurationSection, setShowConfigurationSection] = useState(false)
  const [isTagsModalVisible, setIsTagsModalVisible] = useState(false)
  const [isSavingTags, setIsSavingTags] = useState(false)

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
  // Consider pipeline status, loading state, AND demo mode
  const demoMode = isDemoMode()
  // In demo mode, sections should still be clickable for viewing, but editing is disabled
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
        // This ensures re-hydration when the pipeline is edited or status changes
        const topicNames = pipeline.source?.topics?.map((t: any) => t.name).join(',') || ''
        const currentPipelineKey = `${pipeline.pipeline_id}-${pipeline.name}-${pipeline.status}-${topicNames}-${pipeline.version || 'v1'}`
        const lastHydratedKey = sessionStorage.getItem('lastHydratedPipeline')

        // CRITICAL: Check if cache says we're hydrated, but also verify stores actually have data
        // After a page reload, sessionStorage persists but Zustand stores are empty
        if (lastHydratedKey === currentPipelineKey) {
          // Verify that stores actually have data before skipping hydration
          const { topicsStore } = useStore.getState()
          const hasTopics = topicsStore.topics && Object.keys(topicsStore.topics).length > 0

          if (hasTopics) {
            // ENHANCED VALIDATION: Also verify that topics have event data
            // Without event data, ClickHouse mapping won't have fields to display
            const topicsHaveEventData = Object.values(topicsStore.topics).every(
              (topic: any) => topic?.selectedEvent?.event !== undefined,
            )

            if (topicsHaveEventData) {
              return
            } else {
              sessionStorage.removeItem('lastHydratedPipeline')
              // Continue with hydration
            }
          } else {
            // Clear the stale cache and proceed with hydration
            sessionStorage.removeItem('lastHydratedPipeline')
          }
        }

        try {
          // 1. Detect version and get appropriate adapter
          // Use pipeline.version if available, or fallback to V1 (handled by factory) but added here for safety
          const adapter = getPipelineAdapter(pipeline?.version || 'v1')

          // 2. Hydrate raw API config into InternalPipelineConfig
          // pipeline is currently typed as Pipeline which acts as our InternalPipelineConfig
          // but at this boundary it's actually an API response that might differ in structure
          const internalConfig = adapter.hydrate(pipeline)

          // 3. Pass internal config to store
          // pipeline hydration is handled by the enterViewMode function from the core store
          await enterViewMode(internalConfig)

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

  // Handle sidebar section click - sets both the active section and the active step
  const handleSectionClick = (section: SidebarSection) => {
    // Prevent section clicks when editing is disabled (but allow in demo mode for viewing)
    if (isEditingDisabled && !demoMode && section !== 'monitor') {
      return
    }

    setActiveSection(section)

    // Get the sidebar items to find the step key for this section
    const items = getSidebarItems(pipeline)
    const item = items.find((i) => i.key === section)

    if (item?.stepKey) {
      setActiveStep(item.stepKey)
      // Set the topic index for multi-topic deduplication
      if (item.topicIndex !== undefined) {
        setActiveTopicIndex(item.topicIndex)
      }
    } else {
      // For sections without a step key (like 'monitor' or 'filter'), close any open step
      setActiveStep(null)
    }
  }

  // Set active step directly (used by the transformation section cards)
  const handleStepClick = (step: StepKeys, topicIndex?: number) => {
    // Prevent step clicks when editing is disabled (but allow in demo mode for viewing)
    if (isEditingDisabled && !demoMode) {
      return
    }

    setActiveStep(step)

    // Set the topic index if provided
    if (topicIndex !== undefined) {
      setActiveTopicIndex(topicIndex)
    }

    // Also update the sidebar section to match the clicked step
    const items = getSidebarItems(pipeline)
    const item = items.find((i) => i.stepKey === step && (topicIndex === undefined || i.topicIndex === topicIndex))
    if (item) {
      setActiveSection(item.key)
      if (item.topicIndex !== undefined) {
        setActiveTopicIndex(item.topicIndex)
      }
    }
  }

  // close the standalone step renderer
  const handleCloseStep = useCallback(() => {
    setActiveStep(null)
    // When closing a step, go back to monitor view
    setActiveSection('monitor')
  }, [])

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

  const openTagsModal = () => {
    setIsTagsModalVisible(true)
  }

  const closeTagsModal = () => {
    if (isSavingTags) return
    setIsTagsModalVisible(false)
  }

  const handleTagsSave = async (newTags: string[]) => {
    setIsSavingTags(true)
    try {
      await updatePipelineMetadata(pipeline.pipeline_id, { tags: newTags })
      setPipeline((prev) => ({
        ...prev,
        metadata: {
          ...(prev.metadata || {}),
          tags: newTags,
        },
      }))
      notify({
        variant: 'success',
        title: 'Tags updated',
        description: 'Pipeline tags have been saved.',
        channel: 'toast',
      })
      setIsTagsModalVisible(false)
    } catch (error) {
      handleApiError(error, {
        operation: 'update tags',
        pipelineName: pipeline.name,
      })
    } finally {
      setIsSavingTags(false)
    }
  }

  // Section selection highlighting - determine which overview card should be highlighted
  const SOURCE_STEPS = new Set<StepKeys>([StepKeys.KAFKA_CONNECTION])
  const TRANSFORMATION_STEPS = new Set<StepKeys>([
    StepKeys.TOPIC_SELECTION_1,
    StepKeys.TOPIC_SELECTION_2,
    StepKeys.DEDUPLICATION_CONFIGURATOR,
    StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
    StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
    StepKeys.FILTER_CONFIGURATOR,
    StepKeys.TRANSFORMATION_CONFIGURATOR,
    StepKeys.JOIN_CONFIGURATOR,
    StepKeys.CLICKHOUSE_MAPPER,
  ])
  const SINK_STEPS = new Set<StepKeys>([StepKeys.CLICKHOUSE_CONNECTION])

  const isSourceSelected = activeStep ? SOURCE_STEPS.has(activeStep) : false
  const isSinkSelected = activeStep ? SINK_STEPS.has(activeStep) : false

  return (
    <div className="container mx-auto px-4 sm:px-0">
      {/* Two-column layout: Sidebar extends to top + Content (Header + Main) */}
      <div
        className={cn(
          'flex flex-row gap-6 sm:gap-8 w-full py-4 transition-all duration-750 ease-out',
          showConfigurationSection ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}
      >
        {/* Left Sidebar - extends from top */}
        <PipelineDetailsSidebar
          pipeline={pipeline}
          activeSection={activeSection}
          onSectionClick={handleSectionClick}
          disabled={isEditingDisabled && !demoMode}
        />

        {/* Right Content Area - contains Header + Main Content */}
        <div className="grow flex flex-col gap-4">
          {/* Header Section - contained within right column */}
          <PipelineDetailsHeader
            pipeline={pipeline}
            onPipelineUpdate={handlePipelineUpdate}
            onPipelineDeleted={handlePipelineDeleted}
            showHeader={showHeader}
            onManageTags={openTagsModal}
            tags={pipeline.metadata?.tags}
          />

          {/* Main Content Area */}
          <div className="grow">
            {/* Show Status Overview when 'monitor' is selected and no step is active */}
            {activeSection === 'monitor' && !activeStep && (
              <>
                <PipelineStatusOverviewSection pipeline={pipeline} showStatusOverview={showStatusOverview} />

                {/* Pipeline Configuration Overview - shows the visual representation of the pipeline */}
                <div
                  className={cn(
                    'flex flex-row gap-4 items-stretch transition-all duration-750 ease-out mt-6',
                    showConfigurationSection ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
                  )}
                >
                  <KafkaConnectionSection
                    disabled={isEditingDisabled && !demoMode}
                    selected={isSourceSelected}
                    onStepClick={handleStepClick}
                  />
                  <TransformationSection
                    pipeline={pipeline}
                    onStepClick={handleStepClick}
                    disabled={isEditingDisabled && !demoMode}
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
                    disabled={isEditingDisabled && !demoMode}
                    selected={isSinkSelected}
                    onStepClick={handleStepClick}
                  />
                </div>
              </>
            )}

            {/* Render the standalone step renderer when a step is active */}
            {activeStep && (
              <StandaloneStepRenderer
                stepKey={activeStep}
                onClose={handleCloseStep}
                pipeline={pipeline}
                onPipelineStatusUpdate={handlePipelineStatusUpdate}
                topicIndex={activeTopicIndex}
              />
            )}
          </div>
        </div>
      </div>

      <PipelineTagsModal
        visible={isTagsModalVisible}
        pipelineName={pipeline.name}
        initialTags={pipeline.metadata?.tags || []}
        onSave={handleTagsSave}
        onCancel={closeTagsModal}
        isSaving={isSavingTags}
      />
    </div>
  )
}

export default PipelineDetailsModule
