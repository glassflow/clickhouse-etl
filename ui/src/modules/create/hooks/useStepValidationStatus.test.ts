import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStepValidationStatus } from './useStepValidationStatus'
import { useStore } from '@/src/store'
import { StepKeys } from '@/src/config/constants'

describe('useStepValidationStatus', () => {
  beforeEach(() => {
    // Reset all stores to initial state
    useStore.getState().resetForNewPipeline(1)
  })

  describe('getValidationStatus', () => {
    it('returns "not-configured" for unconfigured kafka connection step', () => {
      const { result } = renderHook(() => useStepValidationStatus())
      expect(result.current.getValidationStatus(StepKeys.KAFKA_CONNECTION)).toBe('not-configured')
    })

    it('returns "valid" after kafkaStore is marked as valid', () => {
      const { result } = renderHook(() => useStepValidationStatus())

      act(() => {
        useStore.getState().kafkaStore.markAsValid()
      })

      expect(result.current.getValidationStatus(StepKeys.KAFKA_CONNECTION)).toBe('valid')
    })

    it('returns "invalidated" after kafkaStore is marked as invalidated', () => {
      const { result } = renderHook(() => useStepValidationStatus())

      act(() => {
        useStore.getState().kafkaStore.markAsInvalidated('test-reason')
      })

      expect(result.current.getValidationStatus(StepKeys.KAFKA_CONNECTION)).toBe('invalidated')
    })

    it('returns validation status for topic-related steps from topicsStore', () => {
      const { result } = renderHook(() => useStepValidationStatus())

      act(() => {
        useStore.getState().topicsStore.markAsValid()
      })

      expect(result.current.getValidationStatus(StepKeys.TOPIC_SELECTION_1)).toBe('valid')
      expect(result.current.getValidationStatus(StepKeys.TOPIC_SELECTION_2)).toBe('valid')
      expect(result.current.getValidationStatus(StepKeys.KAFKA_TYPE_VERIFICATION)).toBe('valid')
    })

    it('returns validation status for deduplication step from deduplicationStore', () => {
      const { result } = renderHook(() => useStepValidationStatus())

      act(() => {
        useStore.getState().deduplicationStore.markAsValid()
      })

      expect(result.current.getValidationStatus(StepKeys.DEDUPLICATION_CONFIGURATOR)).toBe('valid')
    })

    it('returns validation status for filter step from filterStore', () => {
      const { result } = renderHook(() => useStepValidationStatus())

      act(() => {
        useStore.getState().filterStore.markAsValid()
      })

      expect(result.current.getValidationStatus(StepKeys.FILTER_CONFIGURATOR)).toBe('valid')
    })

    it('returns validation status for transformation step from transformationStore', () => {
      const { result } = renderHook(() => useStepValidationStatus())

      act(() => {
        useStore.getState().transformationStore.markAsValid()
      })

      expect(result.current.getValidationStatus(StepKeys.TRANSFORMATION_CONFIGURATOR)).toBe('valid')
    })

    it('returns validation status for join step from joinStore', () => {
      const { result } = renderHook(() => useStepValidationStatus())

      act(() => {
        useStore.getState().joinStore.markAsValid()
      })

      expect(result.current.getValidationStatus(StepKeys.JOIN_CONFIGURATOR)).toBe('valid')
    })

    it('returns validation status for ClickHouse connection step from clickhouseConnectionStore', () => {
      const { result } = renderHook(() => useStepValidationStatus())

      act(() => {
        useStore.getState().clickhouseConnectionStore.markAsValid()
      })

      expect(result.current.getValidationStatus(StepKeys.CLICKHOUSE_CONNECTION)).toBe('valid')
    })

    it('returns validation status for ClickHouse mapper step from clickhouseDestinationStore', () => {
      const { result } = renderHook(() => useStepValidationStatus())

      act(() => {
        useStore.getState().clickhouseDestinationStore.markAsValid()
      })

      expect(result.current.getValidationStatus(StepKeys.CLICKHOUSE_MAPPER)).toBe('valid')
    })

    it('returns "valid" for non-config steps (REVIEW_CONFIGURATION)', () => {
      const { result } = renderHook(() => useStepValidationStatus())

      // Non-config steps should always return valid so they don't block navigation
      expect(result.current.getValidationStatus(StepKeys.REVIEW_CONFIGURATION)).toBe('valid')
    })

    it('returns "valid" for non-config steps (DEPLOY_PIPELINE)', () => {
      const { result } = renderHook(() => useStepValidationStatus())

      expect(result.current.getValidationStatus(StepKeys.DEPLOY_PIPELINE)).toBe('valid')
    })
  })

  describe('validation state transitions', () => {
    it('correctly tracks state transitions from not-configured to valid to invalidated', () => {
      const { result } = renderHook(() => useStepValidationStatus())

      // Initially not configured
      expect(result.current.getValidationStatus(StepKeys.KAFKA_CONNECTION)).toBe('not-configured')

      // Mark as valid
      act(() => {
        useStore.getState().kafkaStore.markAsValid()
      })
      expect(result.current.getValidationStatus(StepKeys.KAFKA_CONNECTION)).toBe('valid')

      // Mark as invalidated
      act(() => {
        useStore.getState().kafkaStore.markAsInvalidated('downstream-change')
      })
      expect(result.current.getValidationStatus(StepKeys.KAFKA_CONNECTION)).toBe('invalidated')

      // Reset validation
      act(() => {
        useStore.getState().kafkaStore.resetValidation()
      })
      expect(result.current.getValidationStatus(StepKeys.KAFKA_CONNECTION)).toBe('not-configured')
    })
  })
})
