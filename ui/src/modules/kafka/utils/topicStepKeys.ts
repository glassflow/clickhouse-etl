import { StepKeys } from '@/src/config/constants'

/** Topic-selector step keys (topic selection and topic deduplication configurator for index 0 and 1). */
export const TOPIC_SELECTOR_STEP_KEYS: StepKeys[] = [
  StepKeys.TOPIC_SELECTION_1,
  StepKeys.TOPIC_SELECTION_2,
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
]

/** True when step is one of the four topic-selector steps. */
export function isTopicSelectorStep(step: string): boolean {
  return TOPIC_SELECTOR_STEP_KEYS.includes(step as StepKeys)
}

/**
 * Returns the StepKeys enum value for markSectionAsValid / onCompleteStep when step is a topic-selector step.
 * Returns null for any other step.
 */
export function getTopicStepKeyForValidation(step: string): StepKeys | null {
  if (isTopicSelectorStep(step)) {
    return step as StepKeys
  }
  return null
}

/**
 * Returns validation sections to invalidate for a given topic-selector step.
 * Used by executeTopicSubmitAndInvalidation to avoid long if/else chains.
 */
export function getSectionsToInvalidateForTopicStep(currentStep: string): StepKeys[] {
  switch (currentStep) {
    case StepKeys.TOPIC_SELECTION_1:
      return [StepKeys.DEDUPLICATION_CONFIGURATOR, StepKeys.JOIN_CONFIGURATOR, StepKeys.CLICKHOUSE_MAPPER]
    case StepKeys.TOPIC_SELECTION_2:
    case StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1:
    case StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2:
      return [StepKeys.JOIN_CONFIGURATOR, StepKeys.CLICKHOUSE_MAPPER]
    default:
      if (currentStep && (currentStep.includes('topic-selection') || currentStep.includes('topic-deduplication'))) {
        return [StepKeys.JOIN_CONFIGURATOR, StepKeys.CLICKHOUSE_MAPPER]
      }
      return []
  }
}

/** True when the step is a deduplication configurator step (used for discard sections). */
export function isTopicDeduplicationStep(step: string): boolean {
  return step === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1 || step === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2
}
