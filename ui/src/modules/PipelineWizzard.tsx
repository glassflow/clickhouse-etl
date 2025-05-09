'use client'

import React, { useState, useEffect } from 'react'
import { CheckIcon, ChevronLeftIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { OperationKeys, stepsMetadata } from '@/src/config/constants'
import {
  KafkaConnector,
  KafkaTopicSelector,
  DeduplicationConfigurator,
  ClickhouseConnectionSetup,
  ClickhouseMapper,
  KafkaTopicSelectorSwitch1,
  KafkaTopicSelectorSwitch2,
  TopicDeduplicationSwitch1,
  TopicDeduplicationSwitch2,
  ClickhouseMapperSwitch,
} from '@/src/modules'
import { ReviewConfiguration } from '@/src/modules/ReviewConfiguration'
import { StepKeys } from '@/src/config/constants'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { validateStep } from '@/src/scheme/validators'
import { useStore } from '@/src/store'
import { JoinConfiguratorWrapper } from './JoinConfiguratorWrapper'

const deduplicationJourney = [
  StepKeys.KAFKA_CONNECTION,
  StepKeys.TOPIC_SELECTION_1,
  StepKeys.DEDUPLICATION_CONFIGURATOR,
  StepKeys.CLICKHOUSE_CONNECTION,
  StepKeys.CLICKHOUSE_MAPPER,
  StepKeys.REVIEW_CONFIGURATION,
]

const joinJourney = [
  StepKeys.KAFKA_CONNECTION,
  StepKeys.TOPIC_SELECTION_1, // duplicate step - we need to add a new topic - topic 1
  StepKeys.TOPIC_SELECTION_2, // duplicate step - we need to add a new topic - topic 2
  StepKeys.JOIN_CONFIGURATOR,
  StepKeys.CLICKHOUSE_CONNECTION,
  StepKeys.CLICKHOUSE_MAPPER,
  StepKeys.REVIEW_CONFIGURATION,
]

const ingestOnlyJourney = [
  StepKeys.KAFKA_CONNECTION,
  StepKeys.TOPIC_SELECTION_1,
  StepKeys.CLICKHOUSE_CONNECTION,
  StepKeys.CLICKHOUSE_MAPPER,
  StepKeys.REVIEW_CONFIGURATION,
]

const deduplicateJoinJourney = [
  StepKeys.KAFKA_CONNECTION,
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
  StepKeys.JOIN_CONFIGURATOR,
  StepKeys.CLICKHOUSE_CONNECTION,
  StepKeys.CLICKHOUSE_MAPPER,
  StepKeys.REVIEW_CONFIGURATION,
]

const componentsMap = {
  [StepKeys.KAFKA_CONNECTION]: KafkaConnector,
  [StepKeys.TOPIC_SELECTION_1]: KafkaTopicSelectorSwitch1,
  [StepKeys.TOPIC_SELECTION_2]: KafkaTopicSelectorSwitch2,
  [StepKeys.DEDUPLICATION_CONFIGURATOR]: DeduplicationConfigurator,
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1]: TopicDeduplicationSwitch1,
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2]: TopicDeduplicationSwitch2,
  [StepKeys.JOIN_CONFIGURATOR]: JoinConfiguratorWrapper,
  [StepKeys.CLICKHOUSE_CONNECTION]: ClickhouseConnectionSetup,
  [StepKeys.CLICKHOUSE_MAPPER]: ClickhouseMapperSwitch,
  [StepKeys.REVIEW_CONFIGURATION]: ReviewConfiguration,
}

const getNextStep = (currentStepName: string, stepComponents: Record<StepKeys, React.ComponentType<any>>) => {
  const index = Object.keys(stepComponents).findIndex((component) => component === currentStepName)
  return Object.keys(stepComponents)[index + 1]
}

const getWizardJourneySteps = (operation: string | undefined): Record<string, React.ComponentType<any>> => {
  if (!operation) {
    // Return empty object if operation is undefined
    return {}
  }

  const getJourney = (journey: StepKeys[]) => {
    return journey.reduce(
      (acc, step) => {
        // @ts-expect-error - FIXME: fix this later
        acc[step] = componentsMap[step]
        return acc
      },
      {} as Record<StepKeys, React.ComponentType<any>>,
    )
  }

  switch (operation) {
    case OperationKeys.DEDUPLICATION:
      return getJourney(deduplicationJourney)
    case OperationKeys.JOINING:
      return getJourney(joinJourney)
    case OperationKeys.INGEST_ONLY:
      return getJourney(ingestOnlyJourney)
    case OperationKeys.DEDUPLICATION_JOINING:
      return getJourney(deduplicateJoinJourney)
    default:
      return {}
  }
}

function PipelineWizzard() {
  const { operationsSelected } = useStore()
  const router = useRouter()

  // If no operation is selected, redirect to home
  useEffect(() => {
    if (!operationsSelected?.operation) {
      router.push('/')
      return
    }
  }, [operationsSelected, router])

  // Determine the current journey based on operation
  const currentJourney = React.useMemo(() => {
    switch (operationsSelected?.operation) {
      case OperationKeys.DEDUPLICATION:
        return deduplicationJourney
      case OperationKeys.JOINING:
        return joinJourney
      case OperationKeys.INGEST_ONLY:
        return ingestOnlyJourney
      case OperationKeys.DEDUPLICATION_JOINING:
        return deduplicateJoinJourney
      default:
        return []
    }
  }, [operationsSelected?.operation])

  const stepComponents = getWizardJourneySteps(operationsSelected?.operation)
  const { completedSteps, setCompletedSteps, activeStep, setActiveStep, addCompletedStep } = useStore()
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
  const renderStepComponent = (stepKey: string) => {
    if (!stepComponents || !stepKey || !(stepKey in stepComponents)) {
      console.error(`Step component for key "${stepKey}" not found`)
      return null
    }

    const StepComponent = stepComponents[stepKey]
    return <StepComponent steps={stepsMetadata} onNext={(step: StepKeys) => handleNext(step)} validate={validateStep} />
  }

  const getCompletedStepTitle = (stepName: StepKeys) => {
    // Check if stepName is a valid key
    if (!stepName) {
      return 'Step'
    }

    const step = stepsMetadata[stepName]
    const topicsStore = useStore.getState().topicsStore || { topics: [] }

    // First check specific step types regardless of operation
    if (stepName === StepKeys.TOPIC_SELECTION_1 || stepName === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1) {
      // For join journeys, always call the first topic "Left Topic"
      if (
        operationsSelected?.operation === OperationKeys.JOINING ||
        operationsSelected?.operation === OperationKeys.DEDUPLICATION_JOINING
      ) {
        const topic = topicsStore.topics?.[0]
        return `Select Left Topic: ${topic?.name || ''}`
      }
      // For non-join journeys, call it just "Topic"
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
      // For join journeys, always call the first topic "Left Topic"
      if (
        operationsSelected?.operation === OperationKeys.JOINING ||
        operationsSelected?.operation === OperationKeys.DEDUPLICATION_JOINING
      ) {
        const topic = topicsStore.topics?.[0]
        return `Select Left Topic: ${topic?.name || ''}`
      }
      // For non-join journeys, call it just "Topic"
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
                  <Card className="card-gradient p-4">
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
                    <CardContent>{renderStepComponent(stepName)}</CardContent>
                  </Card>
                ) : (
                  /* Otherwise show it as a tab */
                  <button
                    onClick={() => handleStepClick(stepName)}
                    className="flex items-center justify-between p-4 w-full card-gradient"
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
          <Card className="card-gradient p-4">
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
            <CardContent>{renderStepComponent(currentActiveStep)}</CardContent>
          </Card>
        )}

        {/* We no longer show future steps */}
      </div>
    </div>
  )
}

export default PipelineWizzard
