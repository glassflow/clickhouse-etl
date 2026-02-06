import { useCallback } from 'react'
import { StepKeys } from '@/src/config/constants'
import type { StepInstance } from '../utils'
import type { ValidationStatus } from './useStepValidationStatus'

/**
 * Options for the useWizardSmartNavigation hook.
 */
export interface UseWizardSmartNavigationOptions {
  /** The current journey as an ordered array of step instances */
  journey: StepInstance[]
  /** Currently active step ID */
  activeStepId: string | null
  /** Step ID to resume to after editing an earlier step */
  resumeStepId: string | null
  /** List of completed step IDs */
  completedStepIds: string[]
  /** Function to get validation status for a step key */
  getValidationStatusForStep: (stepKey: StepKeys) => ValidationStatus
  /** Action to set the active step */
  setActiveStepId: (id: string | null) => void
  /** Action to add a step to completed list */
  addCompletedStepId: (id: string) => void
  /** Action to replace all completed step IDs */
  setCompletedStepIds: (ids: string[]) => void
  /** Action to set the resume target step */
  setResumeStepId: (id: string | null) => void
  /** Action to clear the resume target */
  clearResumeStepId: () => void
  /** Action to remove completed steps after a given ID in journey order */
  removeCompletedStepsAfterId: (instanceId: string, journeyInstanceIds: string[]) => void
}

/**
 * Result of the smart continue operation.
 */
export interface SmartContinueResult {
  /** The next step ID to navigate to, or null if at the end */
  nextStepId: string | null
  /** Whether navigation should route away from the wizard (e.g., to /pipelines/) */
  shouldRouteAway?: boolean
  /** The key of the current step (for special handling like REVIEW_CONFIGURATION) */
  currentStepKey?: StepKeys
}

/**
 * Result of the useWizardSmartNavigation hook.
 */
export interface UseWizardSmartNavigationResult {
  /**
   * Handle "Continue" click with smart resume logic.
   * Determines whether to:
   * - Navigate to the next step
   * - Jump to a blocking (invalidated) step
   * - Resume to the original step the user was editing
   */
  handleSmartContinue: () => SmartContinueResult

  /**
   * Handle sidebar navigation with resume target management.
   * Sets/clears the resume target based on navigation direction.
   */
  handleSidebarNavigation: (targetStepId: string) => void

  /**
   * Find the first blocking (invalidated) step between two indices.
   * Returns the blocking step instance, or null if none found.
   */
  findBlockingStep: (fromIndex: number, toIndex: number) => StepInstance | null
}

/**
 * Hook for smart wizard navigation with resume-to-last-editing behavior.
 *
 * This hook encapsulates the logic for:
 * 1. Smart continue: When user edits an earlier step, resume to where they left off
 *    unless downstream steps are invalidated
 * 2. Blocking step detection: Find invalidated steps that block resume navigation
 * 3. Sidebar navigation: Set/clear resume target when navigating backward/forward
 *
 * @example
 * ```tsx
 * const { handleSmartContinue, handleSidebarNavigation } = useWizardSmartNavigation({
 *   journey: currentJourney,
 *   activeStepId,
 *   resumeStepId,
 *   completedStepIds,
 *   getValidationStatusForStep: getValidationStatus,
 *   setActiveStepId,
 *   addCompletedStepId,
 *   setCompletedStepIds,
 *   setResumeStepId,
 *   clearResumeStepId,
 *   removeCompletedStepsAfterId,
 * })
 *
 * const handleNext = () => {
 *   addCompletedStepId(activeStepId)
 *   const result = handleSmartContinue()
 *   if (result.shouldRouteAway) {
 *     router.push('/pipelines/')
 *   }
 * }
 * ```
 */
export function useWizardSmartNavigation(options: UseWizardSmartNavigationOptions): UseWizardSmartNavigationResult {
  const {
    journey,
    activeStepId,
    resumeStepId,
    getValidationStatusForStep,
    setActiveStepId,
    setCompletedStepIds,
    clearResumeStepId,
    setResumeStepId,
    removeCompletedStepsAfterId,
  } = options

  /**
   * Find the first blocking (invalidated) step between fromIndex (exclusive) and toIndex (inclusive).
   */
  const findBlockingStep = useCallback(
    (fromIndex: number, toIndex: number): StepInstance | null => {
      const stepsToCheck = journey.slice(fromIndex + 1, toIndex + 1)
      const blockingIdx = stepsToCheck.findIndex((inst) => getValidationStatusForStep(inst.key) !== 'valid')

      if (blockingIdx === -1) {
        return null
      }

      const absoluteBlockingIdx = fromIndex + 1 + blockingIdx
      return journey[absoluteBlockingIdx] ?? null
    },
    [journey, getValidationStatusForStep],
  )

  /**
   * Handle the smart continue logic when user clicks "Continue".
   */
  const handleSmartContinue = useCallback((): SmartContinueResult => {
    const currentId = activeStepId
    if (!currentId) {
      return { nextStepId: null }
    }

    const index = journey.findIndex((inst) => inst.id === currentId)
    if (index === -1) {
      return { nextStepId: null }
    }

    const currentInstance = journey[index]

    // Special case: Review step routes away from wizard
    if (currentInstance.key === StepKeys.REVIEW_CONFIGURATION) {
      const nextInstance = journey[index + 1]
      if (nextInstance) {
        setActiveStepId(nextInstance.id)
      }
      return {
        nextStepId: nextInstance?.id ?? null,
        shouldRouteAway: true,
        currentStepKey: StepKeys.REVIEW_CONFIGURATION,
      }
    }

    // Smart continue: if user navigated back to edit an earlier step,
    // resume to the last step they were editing unless something downstream got invalidated.
    const resumeIdx = resumeStepId ? journey.findIndex((inst) => inst.id === resumeStepId) : -1

    if (resumeStepId && resumeIdx > index) {
      const blockingInstance = findBlockingStep(index, resumeIdx)

      if (blockingInstance) {
        // Found a blocking step - navigate there and prune completed steps
        const blockingIdx = journey.findIndex((inst) => inst.id === blockingInstance.id)
        const journeyIds = journey.map((inst) => inst.id)
        const prevInstance = journey[blockingIdx - 1]

        if (prevInstance) {
          removeCompletedStepsAfterId(prevInstance.id, journeyIds)
        } else {
          setCompletedStepIds([])
        }

        setActiveStepId(blockingInstance.id)
        clearResumeStepId()
        return { nextStepId: blockingInstance.id }
      }

      // No blockers: jump straight back to where the user left off
      setActiveStepId(resumeStepId)
      clearResumeStepId()
      return { nextStepId: resumeStepId }
    }

    // Stale resume target (e.g. journey changed) should not affect normal progression
    if (resumeStepId && (resumeIdx === -1 || resumeIdx <= index)) {
      clearResumeStepId()
    }

    // Normal forward navigation
    const nextInstance = journey[index + 1]
    if (nextInstance) {
      setActiveStepId(nextInstance.id)
      return { nextStepId: nextInstance.id }
    }

    return { nextStepId: null }
  }, [
    activeStepId,
    journey,
    resumeStepId,
    findBlockingStep,
    setActiveStepId,
    setCompletedStepIds,
    clearResumeStepId,
    removeCompletedStepsAfterId,
  ])

  /**
   * Handle sidebar step click with resume target management.
   */
  const handleSidebarNavigation = useCallback(
    (targetStepId: string): void => {
      const fromId = activeStepId
      if (!fromId) {
        setActiveStepId(targetStepId)
        return
      }

      const fromIdx = journey.findIndex((inst) => inst.id === fromId)
      const toIdx = journey.findIndex((inst) => inst.id === targetStepId)

      // Only set resume target when navigating backwards, and never overwrite an existing one
      // (so going further back keeps the original "where I left off" step)
      if (fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx) {
        if (!resumeStepId) {
          setResumeStepId(fromId)
        }
      } else if (resumeStepId) {
        // If user navigates forward or sideways intentionally, drop the resume target
        clearResumeStepId()
      }

      setActiveStepId(targetStepId)
    },
    [activeStepId, journey, resumeStepId, setActiveStepId, setResumeStepId, clearResumeStepId],
  )

  return {
    handleSmartContinue,
    handleSidebarNavigation,
    findBlockingStep,
  }
}
