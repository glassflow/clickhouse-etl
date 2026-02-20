'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { StepKeys, OperationKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import StepRendererPageComponent from './StepRendererPageComponent'
import { useStepDataPreloader } from '@/src/hooks/useStepDataPreloader'
import { StepDataPreloader } from '@/src/components/shared/StepDataPreloader'
import { useEditConfirmationModal } from '../hooks'
import EditConfirmationModal from '../components/EditConfirmationModal'
import { usePipelineActions } from '@/src/hooks/usePipelineActions'
import { usePipelineState } from '@/src/hooks/usePipelineStateAdapter'
import { PipelineStatus } from '@/src/types/pipeline'
import { PipelineTransitionOverlay } from '@/src/components/shared/PipelineTransitionOverlay'
import { isDemoMode } from '@/src/config/feature-flags'
import { getStepConfig, getStepProps, useSafeEnterEditMode } from './step-renderer'
import type { StepBaseProps } from './step-renderer'

interface StandaloneStepRendererProps {
  stepKey: StepKeys
  onClose: () => void
  /** When provided, used when step closes after save (bypasses navigate-away guard in parent) */
  onCloseAfterSave?: () => void
  pipeline?: any
  onPipelineStatusUpdate?: (status: string) => void
  topicIndex?: number // Topic index for multi-topic deduplication (0 = left, 1 = right)
}

/**
 * Get loading text based on the current action
 */
function getLoadingText(lastAction: string | null): string {
  switch (lastAction) {
    case 'stop':
      return 'Stopping pipeline for editing...'
    case 'resume':
      return 'Resuming pipeline...'
    case 'delete':
      return 'Deleting pipeline...'
    case 'rename':
      return 'Renaming pipeline...'
    case 'edit':
      return 'Saving pipeline configuration...'
    default:
      return 'Processing...'
  }
}

function StandaloneStepRenderer({
  stepKey,
  onClose,
  onCloseAfterSave,
  pipeline,
  onPipelineStatusUpdate,
  topicIndex = 0,
}: StandaloneStepRendererProps) {
  // Always start in read-only mode - user must click "Edit" to enable editing
  const [editMode, setEditMode] = useState(false)

  // Track pipeline stopping transition for overlay
  const [isStoppingForEdit, setIsStoppingForEdit] = useState(false)

  // Safe enter edit mode hook
  const { safeEnterEditMode, globalMode } = useSafeEnterEditMode()

  // Get centralized pipeline status
  const centralizedStatus = usePipelineState(pipeline?.pipeline_id)
  // Use centralized status if available, otherwise fall back to pipeline prop
  const effectiveStatus = centralizedStatus || (pipeline?.status as PipelineStatus) || 'stopped'

  // Use the centralized pipeline actions hook for state management
  const { executeAction, actionState } = usePipelineActions(pipeline)

  // Edit confirmation modal
  const {
    isEditConfirmationModalVisible,
    selectedPipeline,
    selectedStep,
    openEditConfirmationModal,
    closeEditConfirmationModal,
  } = useEditConfirmationModal()

  // Pre-load data required for this step
  const preloader = useStepDataPreloader(stepKey, pipeline)

  // Get step configuration from the config map
  const stepConfig = useMemo(() => getStepConfig(stepKey), [stepKey])

  // Handle filter guard - close if step config is not available (e.g., filters disabled)
  useEffect(() => {
    if (stepKey && !stepConfig) {
      onClose()
    }
  }, [stepKey, stepConfig, onClose])

  // Monitor pipeline status changes to detect when it has stopped after edit confirmation
  useEffect(() => {
    if (isStoppingForEdit && effectiveStatus === 'stopped') {
      // Pipeline has stopped, enable edit mode
      setEditMode(true)
      setIsStoppingForEdit(false)
      safeEnterEditMode(pipeline)
    }
  }, [isStoppingForEdit, effectiveStatus, safeEnterEditMode, pipeline])

  // Reset edit mode when step changes
  useEffect(() => {
    if (stepKey) {
      // Start in read-only mode - user must explicitly click Edit to enable editing
      setEditMode(false)
    }
  }, [stepKey])

  const handleNext = (nextStep: StepKeys) => {
    // In StandaloneStepRenderer, we don't navigate to next step
    // This is here for component compatibility
  }

  const handleComplete = (nextStep?: StepKeys, standalone?: boolean) => {
    // In StandaloneStepRenderer, we're always in standalone mode, so always close.
    // Use onCloseAfterSave when provided (e.g. after Save) so parent can skip navigate-away guard.
    ;(onCloseAfterSave ?? onClose)()
  }

  const handleBack = () => {
    // For now, just close the step renderer
    onClose()
  }

  // Check if demo mode is enabled
  const demoMode = isDemoMode()

  // Handle edit mode toggle with confirmation for active pipelines
  const handleToggleEditMode = () => {
    // Disable editing in demo mode
    if (demoMode) {
      return
    }

    if ((effectiveStatus === 'stopped' || effectiveStatus === 'terminated') && !editMode) {
      // For stopped/terminated pipelines, enable edit mode immediately
      setEditMode(true)
      safeEnterEditMode(pipeline)
    } else if ((effectiveStatus === 'active' || effectiveStatus === 'paused') && !editMode) {
      // For active/paused pipelines, show confirmation modal before allowing edit
      openEditConfirmationModal(pipeline, stepConfig)
    } else if (
      effectiveStatus === 'stopping' ||
      effectiveStatus === 'pausing' ||
      effectiveStatus === 'resuming' ||
      effectiveStatus === 'terminating'
    ) {
      // For transitional states, show warning
      console.warn('Edit mode not available while pipeline is in transitional state:', effectiveStatus)
    } else {
      // For other cases (failed, etc), allow editing
      console.warn('Edit mode requested for pipeline status:', effectiveStatus)
      if (!editMode) {
        setEditMode(true)
        safeEnterEditMode(pipeline)
      }
    }
  }

  // Handle edit confirmation using the centralized pipeline actions
  const handleEditConfirmation = async () => {
    if (!selectedPipeline) return

    closeEditConfirmationModal()

    // Show the transition overlay
    setIsStoppingForEdit(true)

    try {
      // Use the centralized pipeline actions to stop the pipeline
      // Backend requires pipeline to be stopped before editing
      await executeAction('stop', { graceful: true })

      // Update pipeline status locally to stopped
      onPipelineStatusUpdate?.('stopped')

      // The useEffect hook monitoring effectiveStatus will handle enabling edit mode
      // when the status changes to 'stopped'
    } catch (error) {
      // Notification will be shown by the pipeline action handler
      // Hide overlay on error
      setIsStoppingForEdit(false)
      // Don't enable edit mode if stop failed
    }
  }

  // Show preloader if data is still loading or if there's an error
  if (preloader.isLoading || preloader.error) {
    return (
      <StepDataPreloader
        isLoading={preloader.isLoading}
        error={preloader.error}
        progress={preloader.progress}
        onRetry={preloader.retry}
        stepTitle={stepConfig?.title || 'Configuration Step'}
      />
    )
  }

  // Don't render the component until preloading is complete and step config exists
  if (!preloader.isComplete || !stepKey || !stepConfig) {
    return null
  }

  const CurrentStepComponent = stepConfig.component

  // Build base props for the step component
  const baseProps: StepBaseProps = {
    steps: { [stepKey]: stepConfig },
    onCompleteStep: handleNext,
    validate: async () => true, // You might want to implement proper validation
    standalone: true,
    onCompleteStandaloneEditing: handleComplete,
    readOnly: !editMode,
    toggleEditMode: handleToggleEditMode,
    pipelineActionState: actionState,
    pipeline,
  }

  // Get extended props based on step type
  const stepProps = getStepProps(stepKey, baseProps, topicIndex)

  return (
    <>
      <StepRendererPageComponent
        stepInfo={stepConfig}
        handleBack={handleBack}
        onClose={onClose}
        isLoading={actionState.isLoading}
        loadingText={getLoadingText(actionState.lastAction)}
      >
        <CurrentStepComponent {...stepProps} />
      </StepRendererPageComponent>

      {/* Edit Confirmation Modal */}
      <EditConfirmationModal
        visible={isEditConfirmationModalVisible}
        onOk={handleEditConfirmation}
        onCancel={closeEditConfirmationModal}
        stepName={selectedStep?.title}
      />

      {/* Pipeline Transition Overlay - shown during stopping transition */}
      <PipelineTransitionOverlay
        visible={isStoppingForEdit}
        title="Stopping Pipeline"
        description="The pipeline is being stopped to enable editing. Please wait while the transition completes..."
      />
    </>
  )
}

export default StandaloneStepRenderer
