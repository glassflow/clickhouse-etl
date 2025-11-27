'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { stepsMetadata } from '@/src/config/constants'
import { StepKeys } from '@/src/config/constants'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { validateStep } from '@/src/scheme/validators'
import { useStore } from '@/src/store'
import { getSingleTopicJourney, getTwoTopicJourney, getWizardJourneySteps, getWizardSidebarSteps } from './wizard-utils'
import { WizardSidebar } from './WizardSidebar'

function PipelineWizard() {
  const { coreStore } = useStore()
  const { topicCount } = coreStore
  const router = useRouter()

  // If no topic count is selected, redirect to home
  useEffect(() => {
    if (!topicCount || topicCount < 1 || topicCount > 2) {
      router.push('/')
      return
    }
  }, [topicCount, router])

  // Determine the current journey based on topic count
  const currentJourney = React.useMemo(() => {
    if (topicCount === 1) {
      return getSingleTopicJourney()
    } else if (topicCount === 2) {
      return getTwoTopicJourney()
    }
    return []
  }, [topicCount])

  // Get sidebar steps configuration
  const sidebarSteps = React.useMemo(() => getWizardSidebarSteps(topicCount), [topicCount])

  const stepComponents = getWizardJourneySteps(topicCount)
  const { stepsStore } = useStore()
  const { completedSteps, activeStep, setActiveStep, addCompletedStep } = stepsStore
  const completedStepsArray = Array.from(completedSteps)
  const [editingStep, setEditingStep] = useState<string | null>(null)
  const [previousActiveStep, setPreviousActiveStep] = useState<string | null>(null)
  // Track which parent step was clicked for deduplication steps to identify the correct occurrence
  const [deduplicationParent, setDeduplicationParent] = useState<string | null>(null)

  // Get all step keys as an array
  const stepsList = React.useMemo(() => (stepComponents ? Object.keys(stepComponents) : []), [stepComponents])
  const firstStep = stepsList[0] as StepKeys

  // Initialize activeStep to the first step if it's not set
  useEffect(() => {
    if (!activeStep && firstStep) {
      setActiveStep(firstStep)
    }
  }, [activeStep, setActiveStep, firstStep])

  const handleNext = (stepName: StepKeys) => {
    // Find the index of the CURRENTLY ACTIVE step in the journey
    // For duplicate step keys (like DEDUPLICATION_CONFIGURATOR), find the correct occurrence
    let currentStepIndex = currentJourney.indexOf(currentActiveStep as StepKeys)

    // If we found a duplicate step key, determine which occurrence we're actually on
    if (currentActiveStep === StepKeys.DEDUPLICATION_CONFIGURATOR && currentStepIndex !== -1) {
      // Find all occurrences of DEDUPLICATION_CONFIGURATOR
      const dedupIndices: number[] = []
      currentJourney.forEach((step, index) => {
        if (step === StepKeys.DEDUPLICATION_CONFIGURATOR) {
          dedupIndices.push(index)
        }
      })

      // Determine which occurrence we're on based on completed steps or parent info
      if (deduplicationParent === StepKeys.TOPIC_SELECTION_2 && dedupIndices.length > 1) {
        currentStepIndex = dedupIndices[dedupIndices.length - 1] // Second occurrence
      } else if (completedSteps.includes(StepKeys.TOPIC_SELECTION_2) && dedupIndices.length > 1) {
        currentStepIndex = dedupIndices[dedupIndices.length - 1] // Second occurrence
      } else if (dedupIndices.length > 0) {
        currentStepIndex = dedupIndices[0] // First occurrence
      }
    }

    if (currentStepIndex !== -1) {
      // Mark the current step as completed
      addCompletedStep(currentActiveStep as StepKeys)

      // Handle special case for review configuration
      if (stepName === StepKeys.REVIEW_CONFIGURATION) {
        setActiveStep(StepKeys.DEPLOY_PIPELINE)
        router.push('/pipelines/')
        return
      }

      // Set the next step as active (follow the journey array)
      const nextStep = currentJourney[currentStepIndex + 1]
      if (nextStep) {
        setActiveStep(nextStep)
        // Clear deduplication parent when moving to next step
        setDeduplicationParent(null)
      }
    }

    // Clear editing state if we were editing
    if (editingStep) {
      setEditingStep(null)
      setPreviousActiveStep(null)
    }
  }

  // Handle step click from sidebar - navigate to completed steps for editing
  const handleStepClick = (stepName: string, parent?: string | null) => {
    if (completedStepsArray.includes(stepName)) {
      // For duplicate step keys (like DEDUPLICATION_CONFIGURATOR), store parent info
      if (stepName === StepKeys.DEDUPLICATION_CONFIGURATOR && parent) {
        setDeduplicationParent(parent)
      } else {
        // Clear parent info for non-deduplication steps
        setDeduplicationParent(null)
      }

      // Store the current active step before switching
      setPreviousActiveStep(activeStep)
      // Mark that we're editing this step
      setEditingStep(stepName)
      // Set this step as active
      setActiveStep(stepName)
    }
  }

  // Use the first step as default if activeStep is not set
  const currentActiveStep = activeStep || firstStep

  // Determine the topic index for a DEDUPLICATION_CONFIGURATOR step based on its position in the journey
  const getDeduplicationTopicIndex = (stepKey: string, activeStepKey: string): number => {
    if (stepKey !== StepKeys.DEDUPLICATION_CONFIGURATOR) {
      return 0 // Default, shouldn't be used
    }

    // If we have parent information from clicking, use it to determine the index
    if (deduplicationParent) {
      if (deduplicationParent === StepKeys.TOPIC_SELECTION_1) {
        return 0 // First topic's deduplication
      }
      if (deduplicationParent === StepKeys.TOPIC_SELECTION_2) {
        return 1 // Second topic's deduplication
      }
    }

    // Find all occurrences of DEDUPLICATION_CONFIGURATOR in the journey
    const dedupIndices: number[] = []
    currentJourney.forEach((step, index) => {
      if (step === StepKeys.DEDUPLICATION_CONFIGURATOR) {
        dedupIndices.push(index)
      }
    })

    // Find the CURRENT position of the active step in the journey
    // We need to find which specific occurrence is active, not just the first one
    let activeStepIndex = -1

    // If active step is DEDUPLICATION_CONFIGURATOR, we need to determine which occurrence
    if (activeStepKey === StepKeys.DEDUPLICATION_CONFIGURATOR && dedupIndices.length > 0) {
      // If TOPIC_SELECTION_2 is completed, we must be on the second deduplication (or beyond)
      // If TOPIC_SELECTION_2 is not completed, we must be on the first deduplication
      if (completedSteps.includes(StepKeys.TOPIC_SELECTION_2)) {
        // We've completed the second topic selection, so we're on the second deduplication
        activeStepIndex = dedupIndices[dedupIndices.length - 1] // Second occurrence
      } else {
        // TOPIC_SELECTION_2 is not completed, so we must be on first deduplication
        activeStepIndex = dedupIndices[0] // First occurrence
      }
    } else {
      // Active step is not a deduplication step, use indexOf
      activeStepIndex = currentJourney.indexOf(activeStepKey as StepKeys)
    }

    // If we found the active step, determine which occurrence it is
    if (activeStepIndex !== -1 && dedupIndices.length > 0) {
      // Check if active step is one of the deduplication occurrences
      if (dedupIndices.includes(activeStepIndex)) {
        // Determine which occurrence based on position
        if (dedupIndices.length > 1 && activeStepIndex === dedupIndices[dedupIndices.length - 1]) {
          return 1 // Second occurrence (after TOPIC_SELECTION_2)
        }
        return 0 // First occurrence (after TOPIC_SELECTION_1)
      }

      // If active step is not a deduplication step, look backwards to find the most recent topic selection
      for (let i = activeStepIndex - 1; i >= 0; i--) {
        const prevStep = currentJourney[i]
        if (prevStep === StepKeys.TOPIC_SELECTION_2) {
          return 1 // Second topic
        }
        if (prevStep === StepKeys.TOPIC_SELECTION_1) {
          return 0 // First topic
        }
      }
    }

    // Fallback: if TOPIC_SELECTION_2 is completed, assume second deduplication
    if (completedSteps.includes(StepKeys.TOPIC_SELECTION_2)) {
      return 1 // Second topic's deduplication
    }

    return 0 // Default to first topic
  }

  // Render a specific step component
  const renderStepComponent = (
    stepKey: string,
    stepComponents: Record<string, React.ComponentType<any>>,
    stepsMetadata: any,
    handleNext: (step: StepKeys) => void,
    validateStep: (step: string, data: unknown) => { success: boolean; errors: any },
  ) => {
    if (!stepComponents || !stepKey || !(stepKey in stepComponents)) {
      console.error(`Step component for key "${stepKey}" not found`)
      return null
    }

    const StepComponent = stepComponents[stepKey]

    // Pass currentStep and enableDeduplication props for KafkaTopicSelector components
    if (
      stepKey === StepKeys.TOPIC_SELECTION_1 ||
      stepKey === StepKeys.TOPIC_SELECTION_2 ||
      stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1 ||
      stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2
    ) {
      // For deduplication configurator steps, enable deduplication functionality
      const enableDeduplication =
        stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1 ||
        stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2

      return (
        <StepComponent
          steps={stepsMetadata}
          onCompleteStep={(step: StepKeys) => handleNext(step)}
          validate={validateStep}
          currentStep={stepKey}
          enableDeduplication={enableDeduplication}
        />
      )
    }

    // For DeduplicationConfigurator, pass the correct topic index
    if (stepKey === StepKeys.DEDUPLICATION_CONFIGURATOR) {
      const topicIndex = getDeduplicationTopicIndex(stepKey, currentActiveStep)
      return <StepComponent onCompleteStep={(step: StepKeys) => handleNext(step)} index={topicIndex} />
    }

    return (
      <StepComponent
        steps={stepsMetadata}
        onCompleteStep={(step: StepKeys) => handleNext(step)}
        validate={validateStep}
      />
    )
  }

  const getStepTitle = (stepName: StepKeys) => {
    // Check if stepName is a valid key
    if (!stepName) {
      return 'Step'
    }

    const step = stepsMetadata[stepName]
    const topicsStore = useStore.getState().topicsStore || { topics: [] }

    if (stepName === StepKeys.TOPIC_SELECTION_1 || stepName === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1) {
      // For two-topic journeys, always call the first topic "Left Topic"
      if (topicCount === 2) {
        const topic = topicsStore.topics?.[0]
        return `Select Left Topic: ${topic?.name || ''}`
      }
      // For single-topic journeys, call it just "Topic"
      else {
        const topic = topicsStore.topics?.[0]
        return `Select Topic: ${topic?.name || ''}`
      }
    }

    if (stepName === StepKeys.TOPIC_SELECTION_2 || stepName === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2) {
      const topic = topicsStore.topics?.[1]
      return `Select Right Topic: ${topic?.name || ''}`
    }

    // Add a null check to prevent accessing title on undefined step
    return step?.title || 'Step'
  }

  return (
    <div className="container mx-auto px-4 sm:px-0">
      <div className="flex items-start gap-6 sm:gap-8 w-full px-4 sm:px-0 py-16 sm:py-20">
        {/* Left Sidebar */}
        <WizardSidebar
          steps={sidebarSteps}
          completedSteps={completedStepsArray}
          activeStep={currentActiveStep}
          onStepClick={handleStepClick}
          journey={currentJourney}
        />

        {/* Main Content Area */}
        <div className="grow">
          {currentActiveStep && (
            <Card className="card card-regular p-4">
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="step-title">{getStepTitle(currentActiveStep as StepKeys)}</span>
                    </div>
                    <ChevronDownIcon className="w-5 h-5" />
                  </div>
                </CardTitle>
                <CardDescription>{stepsMetadata[currentActiveStep as StepKeys]?.description || ''}</CardDescription>
              </CardHeader>
              <CardContent>
                {renderStepComponent(currentActiveStep, stepComponents, stepsMetadata, handleNext, validateStep)}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default PipelineWizard
