/**
 * Hook for managing the active view state in pipeline details.
 *
 * Groups related state variables (activeStep, activeSection, activeTopicIndex)
 * into a single abstraction with coordinated setters.
 *
 * Features:
 * - Single source of truth for "what is being viewed"
 * - Coordinated updates between step and section
 * - Simplified state management for the details module
 */

import { useState, useCallback } from 'react'
import { StepKeys } from '@/src/config/constants'
import type { Pipeline } from '@/src/types/pipeline'
import { getSidebarItems, SidebarSection } from '../PipelineDetailsSidebar'

export interface ActiveViewState {
  /** Currently active step being rendered in StandaloneStepRenderer */
  activeStep: StepKeys | null
  /** Currently highlighted section in the sidebar */
  activeSection: SidebarSection | null
  /** Active topic index for multi-topic operations (0 = left, 1 = right) */
  activeTopicIndex: number
}

export interface UseActiveViewStateResult extends ActiveViewState {
  /**
   * Set the active view by section.
   * Automatically updates activeStep based on the section's step key.
   */
  setViewBySection: (section: SidebarSection, pipeline: Pipeline) => void

  /**
   * Set the active view by step.
   * Automatically updates activeSection based on the step's corresponding sidebar item.
   */
  setViewByStep: (step: StepKeys, pipeline: Pipeline, topicIndex?: number) => void

  /**
   * Close the current step and return to monitor view.
   */
  closeStep: () => void

  /**
   * Direct state setters (for edge cases where coordination isn't needed)
   */
  setActiveStep: (step: StepKeys | null) => void
  setActiveSection: (section: SidebarSection | null) => void
  setActiveTopicIndex: (index: number) => void
}

const DEFAULT_STATE: ActiveViewState = {
  activeStep: null,
  activeSection: 'monitor',
  activeTopicIndex: 0,
}

/**
 * Hook for managing the active view state in pipeline details.
 *
 * @param initialState - Optional initial state values
 * @returns Active view state and setters
 *
 * @example
 * ```tsx
 * const {
 *   activeStep,
 *   activeSection,
 *   activeTopicIndex,
 *   setViewBySection,
 *   setViewByStep,
 *   closeStep,
 * } = useActiveViewState()
 *
 * // Handle sidebar section click
 * const handleSectionClick = (section: SidebarSection) => {
 *   if (isEditingDisabled && section !== 'monitor') return
 *   setViewBySection(section, pipeline)
 * }
 *
 * // Handle step click from transformation cards
 * const handleStepClick = (step: StepKeys, topicIndex?: number) => {
 *   if (isEditingDisabled) return
 *   setViewByStep(step, pipeline, topicIndex)
 * }
 * ```
 */
export function useActiveViewState(
  initialState: Partial<ActiveViewState> = {}
): UseActiveViewStateResult {
  const [activeStep, setActiveStep] = useState<StepKeys | null>(
    initialState.activeStep ?? DEFAULT_STATE.activeStep
  )
  const [activeSection, setActiveSection] = useState<SidebarSection | null>(
    initialState.activeSection ?? DEFAULT_STATE.activeSection
  )
  const [activeTopicIndex, setActiveTopicIndex] = useState<number>(
    initialState.activeTopicIndex ?? DEFAULT_STATE.activeTopicIndex
  )

  /**
   * Set the active view by sidebar section.
   * Looks up the step key from sidebar items and updates both section and step.
   */
  const setViewBySection = useCallback(
    (section: SidebarSection, pipeline: Pipeline) => {
      setActiveSection(section)

      // Get the sidebar items to find the step key for this section
      const items = getSidebarItems(pipeline)
      const item = items.find((i) => i.key === section)

      if (item?.stepKey) {
        setActiveStep(item.stepKey)
        // Set the topic index for multi-topic deduplication
        if (item.topicIndex !== undefined) {
          setActiveTopicIndex(item.topicIndex)
        }
      } else {
        // For sections without a step key (like 'monitor'), close any open step
        setActiveStep(null)
      }
    },
    []
  )

  /**
   * Set the active view by step.
   * Looks up the corresponding sidebar section and updates both.
   */
  const setViewByStep = useCallback(
    (step: StepKeys, pipeline: Pipeline, topicIndex?: number) => {
      setActiveStep(step)

      // Set the topic index if provided
      if (topicIndex !== undefined) {
        setActiveTopicIndex(topicIndex)
      }

      // Find the corresponding sidebar section for this step
      const items = getSidebarItems(pipeline)
      const item = items.find(
        (i) => i.stepKey === step && (topicIndex === undefined || i.topicIndex === topicIndex)
      )

      if (item) {
        setActiveSection(item.key)
        if (item.topicIndex !== undefined) {
          setActiveTopicIndex(item.topicIndex)
        }
      }
    },
    []
  )

  /**
   * Close the current step and return to monitor view.
   */
  const closeStep = useCallback(() => {
    setActiveStep(null)
    setActiveSection('monitor')
  }, [])

  return {
    activeStep,
    activeSection,
    activeTopicIndex,
    setViewBySection,
    setViewByStep,
    closeStep,
    setActiveStep,
    setActiveSection,
    setActiveTopicIndex,
  }
}
