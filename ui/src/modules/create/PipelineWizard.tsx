'use client'

import React, { useState, useEffect } from 'react'
import { CheckIcon, ChevronLeftIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { stepsMetadata } from '@/src/config/constants'
import { StepKeys } from '@/src/config/constants'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { validateStep } from '@/src/scheme/validators'
import { useStore } from '@/src/store'
import { getSingleTopicJourney, getTwoTopicJourney, getWizardJourneySteps } from './wizard-utils'

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

  const stepComponents = getWizardJourneySteps(topicCount)
  const { stepsStore } = useStore()
  const { completedSteps, setCompletedSteps, activeStep, setActiveStep, addCompletedStep } = stepsStore
  const completedStepsArray = Array.from(completedSteps)
  const [editingStep, setEditingStep] = useState<string | null>(null)
  const [previousActiveStep, setPreviousActiveStep] = useState<string | null>(null)

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
    // Find the index of the current step in the journey
    const stepIndex = currentJourney.indexOf(stepName)

    if (stepIndex !== -1) {
      // For two-topic journey (join), we need to ensure steps are completed in order
      if (topicCount === 2) {
        // Always mark the current step as completed
        addCompletedStep(stepName)

        // Special handling for topic selection steps
        if (stepName === StepKeys.TOPIC_SELECTION_1) {
          // When completing first topic selection, ensure it's marked as completed
          addCompletedStep(StepKeys.TOPIC_SELECTION_1)
          // Set the next step as active
          setActiveStep(StepKeys.TOPIC_SELECTION_2)
          return
        } else if (stepName === StepKeys.TOPIC_SELECTION_2) {
          // When completing second topic selection, ensure both are marked as completed
          addCompletedStep(StepKeys.TOPIC_SELECTION_1)
          addCompletedStep(StepKeys.TOPIC_SELECTION_2)
        }

        // Set the next step as active
        const nextStep = currentJourney[stepIndex + 1]
        if (nextStep) {
          setActiveStep(nextStep)
        }
      } else {
        // For single-topic journey, maintain the existing behavior
        const previousSteps = currentJourney.slice(0, stepIndex)
        const allPreviousStepsCompleted = previousSteps.every((step) => completedSteps.includes(step))

        if (allPreviousStepsCompleted) {
          addCompletedStep(stepName)
        }

        // Handle special case for review configuration
        if (stepName === StepKeys.REVIEW_CONFIGURATION) {
          setActiveStep(StepKeys.DEPLOY_PIPELINE)
          router.push('/pipelines/')
          return
        }

        // Set the next step as active
        const nextStep = currentJourney[stepIndex + 1]
        if (nextStep) {
          setActiveStep(nextStep)
        }
      }
    }

    // Clear editing state if we were editing
    if (editingStep) {
      setEditingStep(null)
      setPreviousActiveStep(null)
    }
  }

  // we expand the step when we click on it - regardless of the step being active or not
  const handleStepClick = (stepName: string) => {
    if (completedStepsArray.includes(stepName)) {
      // Store the current active step before switching
      setPreviousActiveStep(activeStep)
      // Mark that we're editing this step
      setEditingStep(stepName)
      // Set this step as active
      setActiveStep(stepName)
    }
  }

  // Get the index of the active step
  const activeStepIndex = activeStep ? stepsList.findIndex((step) => step === activeStep) : 0

  // Use the first step as default if activeStep is not set
  const currentActiveStep = activeStep || firstStep

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

    return (
      <StepComponent
        steps={stepsMetadata}
        onCompleteStep={(step: StepKeys) => handleNext(step)}
        validate={validateStep}
      />
    )
  }

  const getCompletedStepTitle = (stepName: StepKeys) => {
    // Check if stepName is a valid key
    if (!stepName) {
      return 'Step'
    }

    const step = stepsMetadata[stepName]
    const topicsStore = useStore.getState().topicsStore || { topics: [] }

    // First check specific step types regardless of topic count
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

    // Second topic is always a right topic (only exists in join journeys)
    if (stepName === StepKeys.TOPIC_SELECTION_2 || stepName === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2) {
      const topic = topicsStore.topics?.[1]
      return `Select Right Topic: ${topic?.name || ''}`
    }

    // Default to the step's title from metadata
    if (step) {
      return step.title || 'Step'
    }
    return 'Step'
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
    <div className="flex justify-center w-full">
      <div className="flex flex-col gap-4 w-full max-w-[var(--main-container-width)]">
        {/* Completed steps as tabs */}
        {completedStepsArray.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
            {completedStepsArray.map((stepName) => (
              <div key={stepName} className="w-full">
                {/* If this step is active, show its content */}
                {currentActiveStep === stepName ? (
                  <Card className="card card-regular p-4">
                    <CardHeader>
                      <CardTitle>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="step-title">{getStepTitle(stepName as StepKeys)}</span>
                          </div>
                          <ChevronDownIcon className="w-5 h-5" />
                        </div>
                      </CardTitle>
                      <CardDescription>
                        <span className="step-description">
                          {stepsMetadata[stepName as StepKeys]?.description || ''}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {renderStepComponent(stepName, stepComponents, stepsMetadata, handleNext, validateStep)}
                    </CardContent>
                  </Card>
                ) : (
                  /* Otherwise show it as a tab */
                  <button
                    onClick={() => handleStepClick(stepName)}
                    className="flex items-center justify-between p-4 w-full card card-elevated"
                  >
                    <div className="flex items-center">
                      <CheckIcon className="w-5 h-5 text-primary mr-2" />
                      <span className="font-medium">{getCompletedStepTitle(stepName as StepKeys)}</span>
                    </div>
                    {currentActiveStep === stepName ? (
                      <ChevronDownIcon className="w-5 h-5" />
                    ) : (
                      <ChevronLeftIcon className="w-5 h-5" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Current active step (if not in completed steps) */}
        {!completedStepsArray.includes(currentActiveStep) && currentActiveStep && (
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

        {/* We no longer show future steps */}
      </div>
    </div>
  )
}

export default PipelineWizard
