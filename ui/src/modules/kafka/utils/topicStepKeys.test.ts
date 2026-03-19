import { describe, it, expect } from 'vitest'
import { StepKeys } from '@/src/config/constants'
import {
  TOPIC_SELECTOR_STEP_KEYS,
  isTopicSelectorStep,
  getTopicStepKeyForValidation,
  getSectionsToInvalidateForTopicStep,
  isTopicDeduplicationStep,
} from './topicStepKeys'

describe('topicStepKeys', () => {
  describe('TOPIC_SELECTOR_STEP_KEYS', () => {
    it('contains the four topic-selector step keys', () => {
      expect(TOPIC_SELECTOR_STEP_KEYS).toContain(StepKeys.TOPIC_SELECTION_1)
      expect(TOPIC_SELECTOR_STEP_KEYS).toContain(StepKeys.TOPIC_SELECTION_2)
      expect(TOPIC_SELECTOR_STEP_KEYS).toContain(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)
      expect(TOPIC_SELECTOR_STEP_KEYS).toContain(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)
      expect(TOPIC_SELECTOR_STEP_KEYS).toHaveLength(4)
    })
  })

  describe('isTopicSelectorStep', () => {
    it('returns true for TOPIC_SELECTION_1, TOPIC_SELECTION_2, TOPIC_DEDUPLICATION_CONFIGURATOR_1, TOPIC_DEDUPLICATION_CONFIGURATOR_2', () => {
      expect(isTopicSelectorStep(StepKeys.TOPIC_SELECTION_1)).toBe(true)
      expect(isTopicSelectorStep(StepKeys.TOPIC_SELECTION_2)).toBe(true)
      expect(isTopicSelectorStep(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)).toBe(true)
      expect(isTopicSelectorStep(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)).toBe(true)
    })

    it('returns false for KAFKA_CONNECTION, KAFKA_TYPE_VERIFICATION, empty string, unknown', () => {
      expect(isTopicSelectorStep(StepKeys.KAFKA_CONNECTION)).toBe(false)
      expect(isTopicSelectorStep(StepKeys.KAFKA_TYPE_VERIFICATION)).toBe(false)
      expect(isTopicSelectorStep('')).toBe(false)
      expect(isTopicSelectorStep('unknown-step')).toBe(false)
    })
  })

  describe('getTopicStepKeyForValidation', () => {
    it('returns the same step for the four topic steps', () => {
      expect(getTopicStepKeyForValidation(StepKeys.TOPIC_SELECTION_1)).toBe(StepKeys.TOPIC_SELECTION_1)
      expect(getTopicStepKeyForValidation(StepKeys.TOPIC_SELECTION_2)).toBe(StepKeys.TOPIC_SELECTION_2)
      expect(getTopicStepKeyForValidation(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)).toBe(
        StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
      )
      expect(getTopicStepKeyForValidation(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)).toBe(
        StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
      )
    })

    it('returns null for other steps', () => {
      expect(getTopicStepKeyForValidation(StepKeys.KAFKA_CONNECTION)).toBeNull()
      expect(getTopicStepKeyForValidation(StepKeys.KAFKA_TYPE_VERIFICATION)).toBeNull()
      expect(getTopicStepKeyForValidation('')).toBeNull()
      expect(getTopicStepKeyForValidation('unknown')).toBeNull()
    })
  })

  describe('getSectionsToInvalidateForTopicStep', () => {
    it('returns DEDUPLICATION_CONFIGURATOR, JOIN_CONFIGURATOR, CLICKHOUSE_MAPPER for TOPIC_SELECTION_1', () => {
      const result = getSectionsToInvalidateForTopicStep(StepKeys.TOPIC_SELECTION_1)
      expect(result).toEqual([
        StepKeys.DEDUPLICATION_CONFIGURATOR,
        StepKeys.JOIN_CONFIGURATOR,
        StepKeys.CLICKHOUSE_MAPPER,
      ])
    })

    it('returns JOIN_CONFIGURATOR, CLICKHOUSE_MAPPER for TOPIC_SELECTION_2 and deduplication configurator steps', () => {
      const expected = [StepKeys.JOIN_CONFIGURATOR, StepKeys.CLICKHOUSE_MAPPER]
      expect(getSectionsToInvalidateForTopicStep(StepKeys.TOPIC_SELECTION_2)).toEqual(expected)
      expect(getSectionsToInvalidateForTopicStep(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)).toEqual(expected)
      expect(getSectionsToInvalidateForTopicStep(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)).toEqual(expected)
    })

    it('returns JOIN_CONFIGURATOR, CLICKHOUSE_MAPPER for string containing topic-selection or topic-deduplication (default fallback)', () => {
      const expected = [StepKeys.JOIN_CONFIGURATOR, StepKeys.CLICKHOUSE_MAPPER]
      expect(getSectionsToInvalidateForTopicStep('topic-selection-other')).toEqual(expected)
      expect(getSectionsToInvalidateForTopicStep('topic-deduplication-configurator-x')).toEqual(expected)
    })

    it('returns empty array for unknown or empty step', () => {
      expect(getSectionsToInvalidateForTopicStep(StepKeys.KAFKA_CONNECTION)).toEqual([])
      expect(getSectionsToInvalidateForTopicStep('')).toEqual([])
      expect(getSectionsToInvalidateForTopicStep('other-step')).toEqual([])
    })
  })

  describe('isTopicDeduplicationStep', () => {
    it('returns true only for TOPIC_DEDUPLICATION_CONFIGURATOR_1 and TOPIC_DEDUPLICATION_CONFIGURATOR_2', () => {
      expect(isTopicDeduplicationStep(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1)).toBe(true)
      expect(isTopicDeduplicationStep(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2)).toBe(true)
    })

    it('returns false for topic selection steps and other steps', () => {
      expect(isTopicDeduplicationStep(StepKeys.TOPIC_SELECTION_1)).toBe(false)
      expect(isTopicDeduplicationStep(StepKeys.TOPIC_SELECTION_2)).toBe(false)
      expect(isTopicDeduplicationStep(StepKeys.KAFKA_CONNECTION)).toBe(false)
      expect(isTopicDeduplicationStep('')).toBe(false)
    })
  })
})
