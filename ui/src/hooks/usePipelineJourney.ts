'use client'

import { useState, useCallback } from 'react'
import { usePipelineStateManagerEnhanced, PipelineJourney } from '@/src/store/pipeline-state-manager'
import { StepKeys } from '@/src/config/constants'

export function usePipelineJourneyEnhanced() {
  const [currentJourney, setCurrentJourney] = useState<PipelineJourney>('creation')
  const [currentPipelineId, setCurrentPipelineId] = useState<string | null>(null)
  const pipelineManager = usePipelineStateManagerEnhanced(currentPipelineId || undefined)

  // 🎯 Switch to creation mode
  const startCreation = useCallback(() => {
    console.log('Starting creation journey')
    setCurrentJourney('creation')
    setCurrentPipelineId(null)
    pipelineManager.switchToCreation()
  }, [pipelineManager])

  // 🎯 Switch to editing mode
  const startEditing = useCallback(
    async (pipelineId: string) => {
      console.log('Starting editing journey for pipeline:', pipelineId)
      setCurrentJourney('editing')
      setCurrentPipelineId(pipelineId)
      await pipelineManager.switchToEditing(pipelineId)
    },
    [pipelineManager],
  )

  // 🎯 Get current journey information
  const getJourneyInfo = useCallback(() => {
    const instanceInfo = pipelineManager.getInstanceInfo()
    return {
      journey: currentJourney,
      pipelineId: currentPipelineId,
      instanceId: instanceInfo.id,
      isCreation: currentJourney === 'creation',
      isEditing: currentJourney === 'editing',
    }
  }, [currentJourney, currentPipelineId, pipelineManager])

  // 🎯 Check if we can switch journeys
  const canSwitchToCreation = useCallback(() => {
    // Can always switch to creation
    return true
  }, [])

  const canSwitchToEditing = useCallback((pipelineId: string) => {
    // Can switch to editing if we have a valid pipeline ID
    return pipelineId && pipelineId.length > 0
  }, [])

  // 🎯 Get journey-specific actions
  const getJourneyActions = useCallback(() => {
    const journeyInfo = getJourneyInfo()

    if (journeyInfo.isCreation) {
      return {
        primaryAction: 'Create Pipeline',
        secondaryAction: 'Switch to Editing',
        canSave: pipelineManager.hasChanges(),
        canDiscard: false, // No discard in creation mode
      }
    } else {
      return {
        primaryAction: 'Save Changes',
        secondaryAction: 'Switch to Creation',
        canSave: pipelineManager.hasChanges(),
        canDiscard: pipelineManager.hasChanges(),
      }
    }
  }, [getJourneyInfo, pipelineManager])

  // 🎯 Enhanced dependency management helpers
  const invalidateStep = useCallback(
    (stepKey: StepKeys, invalidatedBy?: string) => {
      pipelineManager.invalidateStep(stepKey, invalidatedBy)
    },
    [pipelineManager],
  )

  const getStepValidation = useCallback(
    (stepKey: StepKeys) => {
      return pipelineManager.getStepValidation(stepKey)
    },
    [pipelineManager],
  )

  const getInvalidatedSteps = useCallback(() => {
    return pipelineManager.getInvalidatedSteps()
  }, [pipelineManager])

  const resetInvalidatedSteps = useCallback(() => {
    pipelineManager.resetInvalidatedSteps()
  }, [pipelineManager])

  const onStepConfigured = useCallback(
    (stepKey: StepKeys) => {
      pipelineManager.onStepConfigured(stepKey)
    },
    [pipelineManager],
  )

  const onStepReset = useCallback(
    (stepKey: StepKeys) => {
      pipelineManager.onStepReset(stepKey)
    },
    [pipelineManager],
  )

  const getDependencyGraph = useCallback(() => {
    return pipelineManager.getDependencyGraph()
  }, [pipelineManager])

  const getDependentSteps = useCallback(
    (stepKey: StepKeys) => {
      return pipelineManager.getDependentSteps(stepKey)
    },
    [pipelineManager],
  )

  return {
    // Journey state
    currentJourney,
    currentPipelineId,
    pipelineManager,

    // Journey transitions
    startCreation,
    startEditing,

    // Journey information
    getJourneyInfo,

    // Journey validation
    canSwitchToCreation,
    canSwitchToEditing,

    // Journey-specific actions
    getJourneyActions,

    // Enhanced dependency management
    invalidateStep,
    getStepValidation,
    getInvalidatedSteps,
    resetInvalidatedSteps,
    onStepConfigured,
    onStepReset,
    getDependencyGraph,
    getDependentSteps,
  }
}
