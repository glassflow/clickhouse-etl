'use client'

import React, { useEffect } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { structuredLogger } from '@/src/observability'
import { getStepDescriptor } from '@/src/config/step-registry'
import { StepKeys } from '@/src/config/constants'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { validateStep } from '@/src/scheme/validators'
import { getSourceAdapter } from '@/src/adapters/source'
import { useStore } from '@/src/store'
import {
  getWizardJourneyInstances,
  getWizardJourneySteps,
  getSidebarStepsFromInstances,
  type StepInstance,
} from './utils'
import { WizardSidebar } from './WizardSidebar'
import { useStepValidationStatus, useWizardSmartNavigation } from './hooks'

function PipelineWizard() {
  const { coreStore, stepsStore, topicsStore } = useStore()
  const { topicCount, sourceType } = coreStore
  const router = useRouter()

  // If no topic count is selected, redirect to home (OTLP pipelines skip this check)
  useEffect(() => {
    if (getSourceAdapter(sourceType).type !== 'kafka') {
      return // OTLP pipelines don't need topicCount validation
    }
    if (!topicCount || topicCount < 1 || topicCount > 2) {
      router.push('/')
      return
    }
  }, [topicCount, sourceType, router])

  // Journey as step instances (unique id per occurrence)
  const currentJourney = React.useMemo(
    () => getWizardJourneyInstances(topicCount, sourceType),
    [topicCount, sourceType],
  )
  const sidebarSteps = React.useMemo(
    () => {
      if (getSourceAdapter(sourceType).type !== 'kafka') {
        return getSidebarStepsFromInstances(currentJourney, 1)
      }
      return topicCount && topicCount >= 1 && topicCount <= 2
        ? getSidebarStepsFromInstances(currentJourney, topicCount)
        : []
    },
    [currentJourney, topicCount, sourceType],
  )
  const stepComponents = getWizardJourneySteps(topicCount, sourceType)
  const {
    completedStepIds,
    activeStepId,
    resumeStepId,
    setActiveStepId,
    addCompletedStepId,
    setCompletedStepIds,
    setResumeStepId,
    clearResumeStepId,
    removeCompletedStepsAfterId,
  } = stepsStore
  const firstStepId = currentJourney[0]?.id ?? null

  // Initialize activeStepId to the first step if not set or not in current journey
  useEffect(() => {
    if (!currentJourney.length) return
    const currentId = activeStepId
    const isInJourney = currentId && currentJourney.some((inst) => inst.id === currentId)
    if (!currentId || !isInJourney) {
      setActiveStepId(firstStepId)
    }
  }, [activeStepId, currentJourney, firstStepId, setActiveStepId])

  // Scroll to top whenever the active step changes
  useEffect(() => {
    if (activeStepId) {
      window.scrollTo(0, 0)
    }
  }, [activeStepId])

  // Use extracted hooks for validation status and smart navigation
  const { getValidationStatus } = useStepValidationStatus()
  const { handleSmartContinue, handleSidebarNavigation } = useWizardSmartNavigation({
    journey: currentJourney,
    activeStepId,
    resumeStepId,
    completedStepIds,
    getValidationStatusForStep: getValidationStatus,
    setActiveStepId,
    addCompletedStepId,
    setCompletedStepIds,
    setResumeStepId,
    clearResumeStepId,
    removeCompletedStepsAfterId,
  })

  const handleNext = () => {
    const currentId = activeStepId
    if (!currentId) return

    addCompletedStepId(currentId)

    const result = handleSmartContinue()

    // Handle special case: Review step routes away from wizard
    if (result.shouldRouteAway) {
      router.push('/pipelines/')
    }
  }

  const handleSidebarStepClick = (stepInstanceId: string) => {
    if (!completedStepIds.includes(stepInstanceId)) return
    handleSidebarNavigation(stepInstanceId)
  }

  const currentActiveInstance: StepInstance | undefined = currentJourney.find((inst) => inst.id === activeStepId)
  const effectiveStepId = activeStepId ?? firstStepId

  const getStepTitle = (instance: StepInstance) => {
    const stepKey = instance.key
    const step = getStepDescriptor(stepKey)
    const topics = topicsStore?.topics || {}

    if (stepKey === StepKeys.TOPIC_SELECTION_1 || stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1) {
      if (topicCount === 2) {
        const topic = topics?.[0]
        return `Select Left Topic: ${topic?.name || ''}`
      }
      const topic = topics?.[0]
      return `Select Topic: ${topic?.name || ''}`
    }

    if (stepKey === StepKeys.TOPIC_SELECTION_2 || stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2) {
      const topic = topics?.[1]
      return `Select Right Topic: ${topic?.name || ''}`
    }

    return step?.title || 'Step'
  }

  const renderStepComponent = (
    instance: StepInstance,
    stepComponentsMap: Record<string, React.ComponentType<any>>,
    onNext: () => void,
    validateStepFn: (step: string, data: unknown) => { success: boolean; errors: any },
  ) => {
    const stepKey = instance.key
    if (!stepComponentsMap || !stepKey || !(stepKey in stepComponentsMap)) {
      structuredLogger.error('PipelineWizard step component not found', { step_key: stepKey })
      return null
    }

    const StepComponent = stepComponentsMap[stepKey]

    if (
      stepKey === StepKeys.TOPIC_SELECTION_1 ||
      stepKey === StepKeys.TOPIC_SELECTION_2 ||
      stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1 ||
      stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2
    ) {
      const enableDeduplication =
        stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1 ||
        stepKey === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2
      return (
        <StepComponent
          onCompleteStep={onNext}
          validate={validateStepFn}
          currentStep={stepKey}
          enableDeduplication={enableDeduplication}
        />
      )
    }

    if (stepKey === StepKeys.DEDUPLICATION_CONFIGURATOR) {
      const topicIndex = instance.topicIndex ?? 0
      return <StepComponent onCompleteStep={onNext} index={topicIndex} />
    }

    if (stepKey === StepKeys.KAFKA_TYPE_VERIFICATION) {
      const topicIndex = instance.topicIndex ?? 0
      return <StepComponent onCompleteStep={onNext} index={topicIndex} />
    }

    if (stepKey === StepKeys.OTLP_SIGNAL_TYPE || stepKey === StepKeys.OTLP_DEDUPLICATION) {
      return <StepComponent onCompleteStep={onNext} />
    }

    return <StepComponent onCompleteStep={onNext} validate={validateStepFn} />
  }

  return (
    <div className="container mx-auto px-4 sm:px-0">
      <div className="flex items-start gap-6 sm:gap-8 w-full px-4 sm:px-0 py-16 sm:py-20">
        <WizardSidebar
          steps={sidebarSteps}
          completedStepIds={completedStepIds}
          activeStepId={effectiveStepId}
          onStepClick={handleSidebarStepClick}
        />

        <div className="grow">
          {currentActiveInstance && (
            <Card className="card-dark p-4">
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="subtitle">{getStepTitle(currentActiveInstance)}</span>
                    </div>
                    <ChevronDownIcon className="w-5 h-5" />
                  </div>
                </CardTitle>
                <CardDescription className="subtitle-3">
                  {getStepDescriptor(currentActiveInstance.key)?.description || ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderStepComponent(currentActiveInstance, stepComponents, handleNext, validateStep)}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default PipelineWizard
