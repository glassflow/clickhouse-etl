import { StepKeys } from '@/src/config/constants'

/**
 * Steps that are topic selectors and need currentStep prop
 */
const TOPIC_SELECTOR_STEPS = new Set([
  StepKeys.TOPIC_SELECTION_1,
  StepKeys.TOPIC_SELECTION_2,
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
])

/**
 * Steps that are topic+deduplication combined steps
 */
const TOPIC_DEDUPLICATION_STEPS = new Set([
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
])

/**
 * Steps that need an index prop (for multi-topic support)
 */
const INDEX_PROP_STEPS = new Set([
  StepKeys.DEDUPLICATION_CONFIGURATOR,
  StepKeys.KAFKA_TYPE_VERIFICATION,
])

/**
 * Check if a step is a topic selector step
 */
export function isTopicSelectorStep(stepKey: StepKeys): boolean {
  return TOPIC_SELECTOR_STEPS.has(stepKey)
}

/**
 * Check if a step is a topic+deduplication combined step
 */
export function isTopicDeduplicationStep(stepKey: StepKeys): boolean {
  return TOPIC_DEDUPLICATION_STEPS.has(stepKey)
}

/**
 * Check if a step needs an index prop
 */
export function needsIndexProp(stepKey: StepKeys): boolean {
  return INDEX_PROP_STEPS.has(stepKey)
}

/**
 * Base props interface for step components
 */
export interface StepBaseProps {
  steps: Record<string, any>
  onCompleteStep: (nextStep: StepKeys) => void
  validate: () => Promise<boolean>
  standalone: boolean
  onCompleteStandaloneEditing: (nextStep?: StepKeys, standalone?: boolean) => void
  readOnly: boolean
  toggleEditMode: () => void
  pipelineActionState: {
    isLoading: boolean
    lastAction: string | null
  }
  pipeline: any
}

/**
 * Get extended props for a step component based on step type
 * Replaces the nested ternaries in StandaloneStepRenderer
 */
export function getStepProps(
  stepKey: StepKeys,
  baseProps: StepBaseProps,
  topicIndex: number,
): StepBaseProps & Record<string, any> {
  // Topic selector steps need currentStep and enableDeduplication
  if (isTopicSelectorStep(stepKey)) {
    return {
      ...baseProps,
      currentStep: stepKey,
      enableDeduplication: isTopicDeduplicationStep(stepKey),
    }
  }

  // Steps that need index prop (deduplication configurator, type verification)
  if (needsIndexProp(stepKey)) {
    return {
      ...baseProps,
      index: topicIndex,
    }
  }

  // Default: return base props
  return baseProps
}
