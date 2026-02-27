'use client'

import { useState, useEffect, useCallback } from 'react'
import PipelineDetailsHeader from './PipelineDetailsHeader'
import { structuredLogger } from '@/src/observability'
import PipelineStatusOverviewSection from './PipelineStatusOverviewSection'
import TransformationSection from './sections/TransformationSection'
import StandaloneStepRenderer from '@/src/modules/pipelines/[id]/StandaloneStepRenderer'
import { StepKeys } from '@/src/config/constants'
import { isSourceStep, isSinkStep, ANIMATION_DELAYS } from './config/pipeline-details.constants'
import { Pipeline } from '@/src/types/pipeline'
import { useRouter } from 'next/navigation'
import { shouldDisablePipelineOperation } from '@/src/utils/pipeline-actions'
import { usePipelineOperations } from '@/src/hooks/usePipelineStateAdapter'
import { useStore } from '@/src/store'
import { usePipelineActions } from '@/src/hooks/usePipelineActions'
import { getPipeline, updatePipelineMetadata } from '@/src/api/pipeline-api'
import { cn, isDemoMode } from '@/src/utils/common.client'
import { KafkaConnectionSection } from './sections/KafkaConnectionSection'
import { ClickhouseConnectionSection } from './sections/ClickhouseConnectionSection'
import PipelineTagsModal from '@/src/modules/pipelines/components/PipelineTagsModal'
import { handleApiError } from '@/src/notifications/api-error-handler'
import { notify } from '@/src/notifications'
import { PipelineDetailsSidebar, SidebarSection } from './PipelineDetailsSidebar'
import { usePipelineHydration } from '@/src/hooks/usePipelineHydration'
import { useActiveViewState } from './hooks/useActiveViewState'
import { useIsTransformationSectionDirty } from '@/src/modules/transformation/hooks/useIsTransformationSectionDirty'
import { ConfirmationModal, ModalResult } from '@/src/components/common/ConfirmationModal'

type PendingNavigation =
  | { type: 'section'; section: SidebarSection }
  | { type: 'step'; step: StepKeys; topicIndex?: number }
  | { type: 'close' }

function PipelineDetailsModule({ pipeline: initialPipeline }: { pipeline: Pipeline }) {
  const router = useRouter()

  // local copy of the pipeline data - this is used to display the pipeline data in the UI along with its status
  const [pipeline, setPipeline] = useState<Pipeline>(initialPipeline)

  // Active view state - groups activeStep, activeSection, activeTopicIndex
  // Provides coordinated setters that keep sidebar and step renderer in sync
  const {
    activeStep,
    activeSection,
    activeTopicIndex,
    setViewBySection,
    setViewByStep,
    closeStep,
  } = useActiveViewState()

  // Unsaved transformation guard: when user tries to navigate away with dirty transformation section
  const isTransformationSectionDirty = useIsTransformationSectionDirty()
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null)

  // Animation states for sequential appearance
  const [showHeader, setShowHeader] = useState(false)
  const [showStatusOverview, setShowStatusOverview] = useState(false)
  const [showConfigurationSection, setShowConfigurationSection] = useState(false)
  const [isTagsModalVisible, setIsTagsModalVisible] = useState(false)
  const [isSavingTags, setIsSavingTags] = useState(false)
  const [refreshDLQTrigger, setRefreshDLQTrigger] = useState(0)

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

  const { coreStore, transformationStore } = useStore()
  const { mode } = coreStore

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
      structuredLogger.error('PipelineDetailsModule failed to refresh pipeline data', { error: error instanceof Error ? error.message : String(error) })
    }
  }, [pipeline.pipeline_id, pipeline.status])

  // Hydrate the pipeline data into stores when the pipeline configuration is loaded
  // This is extracted into a separate hook for testability and clarity
  usePipelineHydration(pipeline, {
    isActionLoading: actionState.isLoading,
  })

  // Sequential animation effect - show sections one by one
  useEffect(() => {
    // Start the animation sequence
    setShowHeader(true)

    const statusTimer = setTimeout(() => {
      setShowStatusOverview(true)
    }, ANIMATION_DELAYS.STATUS_OVERVIEW)

    const configTimer = setTimeout(() => {
      setShowConfigurationSection(true)
    }, ANIMATION_DELAYS.CONFIGURATION)

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

  // Handle sidebar section click - uses the coordinated view state setter
  // When on transformation step with unsaved changes, show confirmation before navigating
  const handleSectionClick = useCallback(
    (section: SidebarSection) => {
      if (isEditingDisabled && !demoMode && section !== 'monitor') {
        return
      }
      const onTransformationWithDirty =
        activeStep === StepKeys.TRANSFORMATION_CONFIGURATOR &&
        isTransformationSectionDirty &&
        section !== activeSection
      if (onTransformationWithDirty) {
        setPendingNavigation({ type: 'section', section })
        return
      }
      setViewBySection(section, pipeline)
    },
    [
      isEditingDisabled,
      demoMode,
      activeStep,
      activeSection,
      isTransformationSectionDirty,
      setViewBySection,
      pipeline,
    ]
  )

  // Set active step directly (used by the transformation section cards)
  const handleStepClick = useCallback(
    (step: StepKeys, topicIndex?: number) => {
      if (isEditingDisabled && !demoMode) {
        return
      }
      const onTransformationWithDirty =
        activeStep === StepKeys.TRANSFORMATION_CONFIGURATOR &&
        isTransformationSectionDirty &&
        (step !== activeStep || topicIndex !== activeTopicIndex)
      if (onTransformationWithDirty) {
        setPendingNavigation({ type: 'step', step, topicIndex })
        return
      }
      setViewByStep(step, pipeline, topicIndex)
    },
    [
      isEditingDisabled,
      demoMode,
      activeStep,
      activeTopicIndex,
      isTransformationSectionDirty,
      setViewByStep,
      pipeline,
    ]
  )

  // Close the standalone step renderer - when on transformation with unsaved changes, show confirmation
  const handleCloseStep = useCallback(() => {
    const onTransformationWithDirty =
      activeStep === StepKeys.TRANSFORMATION_CONFIGURATOR && isTransformationSectionDirty
    if (onTransformationWithDirty) {
      setPendingNavigation({ type: 'close' })
      return
    }
    closeStep()
  }, [activeStep, isTransformationSectionDirty, closeStep])

  // Confirm "Navigate away" from unsaved transformation: restore to section baseline (or discard from server config) then perform pending navigation
  const handleUnsavedNavigateConfirm = useCallback(async () => {
    if (!pendingNavigation) return
    try {
      const snapshot = transformationStore.getLastSavedTransformationSnapshot()
      if (snapshot) {
        transformationStore.restoreFromLastSavedSnapshot()
      } else {
        await coreStore.discardSection('transformation')
      }
    } finally {
      if (pendingNavigation.type === 'section') {
        setViewBySection(pendingNavigation.section, pipeline)
      } else if (pendingNavigation.type === 'step') {
        setViewByStep(pendingNavigation.step, pipeline, pendingNavigation.topicIndex)
      } else {
        closeStep()
      }
      setPendingNavigation(null)
    }
  }, [pendingNavigation, coreStore, transformationStore, setViewBySection, setViewByStep, closeStep, pipeline])

  const handleUnsavedNavigateCancel = useCallback(() => {
    setPendingNavigation(null)
  }, [])

  const handleDLQFlushed = useCallback(() => {
    setRefreshDLQTrigger((k) => k + 1)
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
  const isSourceSelected = isSourceStep(activeStep)
  const isSinkSelected = isSinkStep(activeStep)

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
            onDLQFlushed={handleDLQFlushed}
            showHeader={showHeader}
            onManageTags={openTagsModal}
            tags={pipeline.metadata?.tags}
          />

          {/* Main Content Area */}
          <div className="grow">
            {/* Show Status Overview when 'monitor' is selected and no step is active */}
            {activeSection === 'monitor' && !activeStep && (
              <>
                <PipelineStatusOverviewSection
                  pipeline={pipeline}
                  showStatusOverview={showStatusOverview}
                  refreshDLQTrigger={refreshDLQTrigger}
                />

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
                onCloseAfterSave={closeStep}
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

      <ConfirmationModal
        visible={pendingNavigation !== null}
        title="Unsaved changes"
        description="You have unsaved changes in Transformations. If you navigate away, these changes will be lost."
        okButtonText="Navigate away"
        cancelButtonText="Cancel"
        onComplete={(result) => {
          if (result === ModalResult.YES) {
            handleUnsavedNavigateConfirm()
          } else {
            handleUnsavedNavigateCancel()
          }
        }}
      />
    </div>
  )
}

export default PipelineDetailsModule
