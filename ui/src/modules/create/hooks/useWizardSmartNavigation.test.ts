import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWizardSmartNavigation } from './useWizardSmartNavigation'
import { StepKeys } from '@/src/config/constants'
import type { StepInstance } from '../utils'
import type { ValidationStatus } from './useStepValidationStatus'

describe('useWizardSmartNavigation', () => {
  // Create a mock journey for testing
  const createMockJourney = (): StepInstance[] => [
    { id: 'kafka-connection-0', key: StepKeys.KAFKA_CONNECTION },
    { id: 'topic-selection-1-0', key: StepKeys.TOPIC_SELECTION_1 },
    { id: 'kafka-type-verification-0', key: StepKeys.KAFKA_TYPE_VERIFICATION, topicIndex: 0 },
    { id: 'deduplication-configurator-0', key: StepKeys.DEDUPLICATION_CONFIGURATOR, topicIndex: 0 },
    { id: 'clickhouse-connection-0', key: StepKeys.CLICKHOUSE_CONNECTION },
    { id: 'clickhouse-mapper-0', key: StepKeys.CLICKHOUSE_MAPPER },
    { id: 'review-configuration-0', key: StepKeys.REVIEW_CONFIGURATION },
  ]

  // Default mock options factory
  const createMockOptions = (overrides: Partial<Parameters<typeof useWizardSmartNavigation>[0]> = {}) => {
    const mockSetActiveStepId = vi.fn()
    const mockAddCompletedStepId = vi.fn()
    const mockSetCompletedStepIds = vi.fn()
    const mockSetResumeStepId = vi.fn()
    const mockClearResumeStepId = vi.fn()
    const mockRemoveCompletedStepsAfterId = vi.fn()

    return {
      journey: createMockJourney(),
      activeStepId: 'kafka-connection-0',
      resumeStepId: null as string | null,
      completedStepIds: [] as string[],
      getValidationStatusForStep: vi.fn().mockReturnValue('valid' as ValidationStatus),
      setActiveStepId: mockSetActiveStepId,
      addCompletedStepId: mockAddCompletedStepId,
      setCompletedStepIds: mockSetCompletedStepIds,
      setResumeStepId: mockSetResumeStepId,
      clearResumeStepId: mockClearResumeStepId,
      removeCompletedStepsAfterId: mockRemoveCompletedStepsAfterId,
      ...overrides,
    }
  }

  describe('handleSmartContinue', () => {
    it('returns null nextStepId when activeStepId is null', () => {
      const options = createMockOptions({ activeStepId: null })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      const { nextStepId } = result.current.handleSmartContinue()
      expect(nextStepId).toBeNull()
    })

    it('navigates to next step in normal forward progression', () => {
      const options = createMockOptions({ activeStepId: 'kafka-connection-0' })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      const { nextStepId } = result.current.handleSmartContinue()
      expect(nextStepId).toBe('topic-selection-1-0')
      expect(options.setActiveStepId).toHaveBeenCalledWith('topic-selection-1-0')
    })

    it('returns shouldRouteAway true for REVIEW_CONFIGURATION step', () => {
      const options = createMockOptions({ activeStepId: 'review-configuration-0' })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      const { shouldRouteAway, currentStepKey } = result.current.handleSmartContinue()
      expect(shouldRouteAway).toBe(true)
      expect(currentStepKey).toBe(StepKeys.REVIEW_CONFIGURATION)
    })

    it('resumes to resumeStepId when no blocking steps exist', () => {
      const options = createMockOptions({
        activeStepId: 'kafka-connection-0',
        resumeStepId: 'clickhouse-connection-0',
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      const { nextStepId } = result.current.handleSmartContinue()
      expect(nextStepId).toBe('clickhouse-connection-0')
      expect(options.setActiveStepId).toHaveBeenCalledWith('clickhouse-connection-0')
      expect(options.clearResumeStepId).toHaveBeenCalled()
    })

    it('navigates to blocking step when downstream step is invalidated', () => {
      const mockGetValidation = vi.fn((stepKey: StepKeys): ValidationStatus => {
        if (stepKey === StepKeys.DEDUPLICATION_CONFIGURATOR) {
          return 'invalidated'
        }
        return 'valid'
      })

      const options = createMockOptions({
        activeStepId: 'kafka-connection-0',
        resumeStepId: 'clickhouse-connection-0',
        getValidationStatusForStep: mockGetValidation,
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      const { nextStepId } = result.current.handleSmartContinue()
      expect(nextStepId).toBe('deduplication-configurator-0')
      expect(options.setActiveStepId).toHaveBeenCalledWith('deduplication-configurator-0')
      expect(options.clearResumeStepId).toHaveBeenCalled()
    })

    it('prunes completed steps when blocking step is found', () => {
      const journey = createMockJourney()
      const mockGetValidation = vi.fn((stepKey: StepKeys): ValidationStatus => {
        if (stepKey === StepKeys.DEDUPLICATION_CONFIGURATOR) {
          return 'invalidated'
        }
        return 'valid'
      })

      const options = createMockOptions({
        activeStepId: 'kafka-connection-0',
        resumeStepId: 'clickhouse-connection-0',
        getValidationStatusForStep: mockGetValidation,
        journey,
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      result.current.handleSmartContinue()

      // Should prune completed steps after the step before the blocking one
      expect(options.removeCompletedStepsAfterId).toHaveBeenCalledWith(
        'kafka-type-verification-0', // step before deduplication-configurator-0
        journey.map((i) => i.id),
      )
    })

    it('clears stale resumeStepId when it is not ahead of current step', () => {
      const options = createMockOptions({
        activeStepId: 'clickhouse-connection-0',
        resumeStepId: 'kafka-connection-0', // behind current step
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      result.current.handleSmartContinue()
      expect(options.clearResumeStepId).toHaveBeenCalled()
    })

    it('clears stale resumeStepId when it is not in the journey', () => {
      const options = createMockOptions({
        activeStepId: 'kafka-connection-0',
        resumeStepId: 'non-existent-step',
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      result.current.handleSmartContinue()
      expect(options.clearResumeStepId).toHaveBeenCalled()
    })

    it('returns null nextStepId when at the end of journey', () => {
      const shortJourney: StepInstance[] = [
        { id: 'only-step', key: StepKeys.KAFKA_CONNECTION },
      ]
      const options = createMockOptions({
        journey: shortJourney,
        activeStepId: 'only-step',
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      const { nextStepId } = result.current.handleSmartContinue()
      expect(nextStepId).toBeNull()
    })
  })

  describe('handleSidebarNavigation', () => {
    it('sets resumeStepId when navigating backwards', () => {
      const options = createMockOptions({
        activeStepId: 'clickhouse-connection-0',
        resumeStepId: null,
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      result.current.handleSidebarNavigation('kafka-connection-0')

      expect(options.setResumeStepId).toHaveBeenCalledWith('clickhouse-connection-0')
      expect(options.setActiveStepId).toHaveBeenCalledWith('kafka-connection-0')
    })

    it('does not overwrite existing resumeStepId when navigating further back', () => {
      const options = createMockOptions({
        activeStepId: 'topic-selection-1-0',
        resumeStepId: 'clickhouse-connection-0', // already set
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      result.current.handleSidebarNavigation('kafka-connection-0')

      // Should not call setResumeStepId since resumeStepId is already set
      expect(options.setResumeStepId).not.toHaveBeenCalled()
      expect(options.setActiveStepId).toHaveBeenCalledWith('kafka-connection-0')
    })

    it('clears resumeStepId when navigating forward', () => {
      const options = createMockOptions({
        activeStepId: 'kafka-connection-0',
        resumeStepId: 'clickhouse-connection-0',
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      result.current.handleSidebarNavigation('topic-selection-1-0')

      expect(options.clearResumeStepId).toHaveBeenCalled()
      expect(options.setActiveStepId).toHaveBeenCalledWith('topic-selection-1-0')
    })

    it('sets activeStepId when no fromId exists', () => {
      const options = createMockOptions({
        activeStepId: null,
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      result.current.handleSidebarNavigation('kafka-connection-0')

      expect(options.setActiveStepId).toHaveBeenCalledWith('kafka-connection-0')
    })
  })

  describe('findBlockingStep', () => {
    it('returns null when no blocking steps exist', () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      const blocking = result.current.findBlockingStep(0, 3)
      expect(blocking).toBeNull()
    })

    it('returns the first blocking step when one exists', () => {
      const mockGetValidation = vi.fn((stepKey: StepKeys): ValidationStatus => {
        if (stepKey === StepKeys.KAFKA_TYPE_VERIFICATION) {
          return 'invalidated'
        }
        return 'valid'
      })

      const options = createMockOptions({
        getValidationStatusForStep: mockGetValidation,
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      const blocking = result.current.findBlockingStep(0, 4)
      expect(blocking).toEqual({
        id: 'kafka-type-verification-0',
        key: StepKeys.KAFKA_TYPE_VERIFICATION,
        topicIndex: 0,
      })
    })

    it('returns the earliest blocking step when multiple exist', () => {
      const mockGetValidation = vi.fn((stepKey: StepKeys): ValidationStatus => {
        if (
          stepKey === StepKeys.KAFKA_TYPE_VERIFICATION ||
          stepKey === StepKeys.DEDUPLICATION_CONFIGURATOR
        ) {
          return 'invalidated'
        }
        return 'valid'
      })

      const options = createMockOptions({
        getValidationStatusForStep: mockGetValidation,
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      const blocking = result.current.findBlockingStep(0, 4)
      // Should return the first one (kafka-type-verification) not the second (deduplication)
      expect(blocking?.key).toBe(StepKeys.KAFKA_TYPE_VERIFICATION)
    })

    it('treats "not-configured" as blocking', () => {
      const mockGetValidation = vi.fn((stepKey: StepKeys): ValidationStatus => {
        if (stepKey === StepKeys.TOPIC_SELECTION_1) {
          return 'not-configured'
        }
        return 'valid'
      })

      const options = createMockOptions({
        getValidationStatusForStep: mockGetValidation,
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      const blocking = result.current.findBlockingStep(0, 3)
      expect(blocking?.key).toBe(StepKeys.TOPIC_SELECTION_1)
    })

    it('searches only within the specified range (exclusive fromIndex, inclusive toIndex)', () => {
      const mockGetValidation = vi.fn((stepKey: StepKeys): ValidationStatus => {
        // Kafka connection is invalidated but should not be found since it's at fromIndex
        if (stepKey === StepKeys.KAFKA_CONNECTION) {
          return 'invalidated'
        }
        // Deduplication is invalidated and within range
        if (stepKey === StepKeys.DEDUPLICATION_CONFIGURATOR) {
          return 'invalidated'
        }
        return 'valid'
      })

      const options = createMockOptions({
        getValidationStatusForStep: mockGetValidation,
      })
      const { result } = renderHook(() => useWizardSmartNavigation(options))

      // Search from index 0 to 4 - should find deduplication (index 3), not kafka-connection (index 0)
      const blocking = result.current.findBlockingStep(0, 4)
      expect(blocking?.key).toBe(StepKeys.DEDUPLICATION_CONFIGURATOR)
    })
  })
})
