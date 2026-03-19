import { useCallback } from 'react'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import type { ValidationState } from '@/src/types/validation'

/**
 * Validation status type matching the store validation states.
 */
export type ValidationStatus = 'not-configured' | 'valid' | 'invalidated'

/**
 * Hook that provides a function to get the validation status for any step.
 *
 * This encapsulates the mapping between step keys and their corresponding
 * store validation states, removing the need for type casts in components.
 *
 * @example
 * ```tsx
 * const { getValidationStatus } = useStepValidationStatus()
 * const kafkaStatus = getValidationStatus(StepKeys.KAFKA_CONNECTION)
 * // kafkaStatus: 'not-configured' | 'valid' | 'invalidated'
 * ```
 */
export function useStepValidationStatus() {
  const {
    kafkaStore,
    topicsStore,
    deduplicationStore,
    filterStore,
    transformationStore,
    joinStore,
    clickhouseConnectionStore,
    clickhouseDestinationStore,
  } = useStore()

  /**
   * Get the validation status for a given step key.
   * Returns the store's validation status, or 'valid' for non-config steps.
   */
  const getValidationStatus = useCallback(
    (stepKey: StepKeys): ValidationStatus => {
      // Map step keys to their corresponding store validation states
      const validationMap: Partial<Record<StepKeys, ValidationState | undefined>> = {
        [StepKeys.KAFKA_CONNECTION]: kafkaStore.validation,
        [StepKeys.TOPIC_SELECTION_1]: topicsStore.validation,
        [StepKeys.TOPIC_SELECTION_2]: topicsStore.validation,
        [StepKeys.KAFKA_TYPE_VERIFICATION]: topicsStore.validation,
        [StepKeys.DEDUPLICATION_CONFIGURATOR]: deduplicationStore.validation,
        [StepKeys.FILTER_CONFIGURATOR]: filterStore.validation,
        [StepKeys.TRANSFORMATION_CONFIGURATOR]: transformationStore.validation,
        [StepKeys.JOIN_CONFIGURATOR]: joinStore.validation,
        [StepKeys.CLICKHOUSE_CONNECTION]: clickhouseConnectionStore.validation,
        [StepKeys.CLICKHOUSE_MAPPER]: clickhouseDestinationStore.validation,
      }

      const validation = validationMap[stepKey]

      // Non-config steps (REVIEW_CONFIGURATION, DEPLOY_PIPELINE, etc.) should not block navigation
      if (validation === undefined) {
        return 'valid'
      }

      return validation.status ?? 'not-configured'
    },
    [
      kafkaStore.validation,
      topicsStore.validation,
      deduplicationStore.validation,
      filterStore.validation,
      transformationStore.validation,
      joinStore.validation,
      clickhouseConnectionStore.validation,
      clickhouseDestinationStore.validation,
    ],
  )

  return { getValidationStatus }
}
