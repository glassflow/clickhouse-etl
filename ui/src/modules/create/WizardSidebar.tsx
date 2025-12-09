'use client'

import React from 'react'
import { StepKeys } from '@/src/config/constants'
import { cn } from '@/src/utils/common.client'
import { getStepIcon, CompletedCheckIcon } from './wizard-step-icons'

export interface SidebarStep {
  key: StepKeys
  title: string
  parent?: StepKeys | null // null means top-level step
}

interface WizardSidebarProps {
  steps: SidebarStep[]
  completedSteps: string[]
  activeStep: string | null
  onStepClick: (stepKey: string, parent?: string | null) => void
  journey?: string[] // Journey array to help determine completion for duplicate step keys
  deduplicationParent?: string | null // Parent step key when a deduplication step was clicked
}

type StepState = 'pending' | 'active' | 'completed'

function getStepState(
  stepKey: string,
  completedSteps: string[],
  activeStep: string | null,
  step: SidebarStep,
  journey?: string[],
  deduplicationParent?: string | null,
): StepState {
  // For steps with duplicate keys (like DEDUPLICATION_CONFIGURATOR), check completion based on journey position
  if (stepKey === 'deduplication-configurator' && journey && step.parent) {
    // Find all occurrences of this step key in the journey
    const stepIndices: number[] = []
    journey.forEach((key, index) => {
      if (key === stepKey) {
        stepIndices.push(index)
      }
    })

    // Determine which occurrence this step represents based on its parent
    let stepOccurrenceIndex = -1
    if (step.parent === 'topic-selection-1') {
      // First deduplication step (after TOPIC_SELECTION_1)
      stepOccurrenceIndex = stepIndices.length > 0 ? stepIndices[0] : -1
    } else if (step.parent === 'topic-selection-2') {
      // Second deduplication step (after TOPIC_SELECTION_2)
      stepOccurrenceIndex = stepIndices.length > 1 ? stepIndices[stepIndices.length - 1] : -1
    }

    // Find the ACTUAL position of the active step in the journey
    // For DEDUPLICATION_CONFIGURATOR, we need to determine which occurrence is actually active
    let activeStepIndex = -1
    if (activeStep === 'deduplication-configurator' && stepIndices.length > 0) {
      // Use deduplicationParent to determine which occurrence is active (set when user clicks on a specific dedup step)
      if (deduplicationParent) {
        if (deduplicationParent === 'topic-selection-1') {
          activeStepIndex = stepIndices[0] // First occurrence
        } else if (deduplicationParent === 'topic-selection-2') {
          activeStepIndex = stepIndices.length > 1 ? stepIndices[stepIndices.length - 1] : stepIndices[0] // Second occurrence
        }
      } else {
        // Fallback: If no deduplicationParent, determine based on completed steps (for normal flow navigation)
        if (completedSteps.includes('topic-selection-2')) {
          activeStepIndex = stepIndices[stepIndices.length - 1] // Second occurrence
        } else {
          activeStepIndex = stepIndices[0] // First occurrence
        }
      }
    } else {
      // For non-deduplication steps, use indexOf
      activeStepIndex = journey.indexOf(activeStep || '')
    }

    // Check if we've progressed past this specific occurrence
    if (stepOccurrenceIndex !== -1 && activeStepIndex !== -1) {
      // If active step is past this occurrence, it's completed
      if (activeStepIndex > stepOccurrenceIndex) {
        return 'completed'
      }
      // If active step is this occurrence, it's active
      if (activeStepIndex === stepOccurrenceIndex) {
        return 'active'
      }
      // Otherwise, it's pending
      return 'pending'
    }
  }

  // Default behavior for non-duplicate steps
  if (completedSteps.includes(stepKey)) {
    return 'completed'
  }
  if (activeStep === stepKey) {
    return 'active'
  }
  return 'pending'
}

interface StepIconProps {
  state: StepState
  stepKey: StepKeys
}

function StepIcon({ state, stepKey }: StepIconProps) {
  const IconComponent = getStepIcon(stepKey)

  if (state === 'completed') {
    return (
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 ease-out bg-[var(--color-background-neutral-faded)]">
        <CompletedCheckIcon />
      </div>
    )
  }

  if (state === 'active') {
    return (
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 ease-out bg-[var(--color-background-neutral)]">
        <IconComponent />
      </div>
    )
  }

  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 ease-out bg-[var(--color-background-neutral-faded)]">
      <IconComponent className="opacity-40" />
    </div>
  )
}

export function WizardSidebar({
  steps,
  completedSteps,
  activeStep,
  onStepClick,
  journey,
  deduplicationParent,
}: WizardSidebarProps) {
  // Separate top-level steps and substeps
  const topLevelSteps = steps.filter((step) => !step.parent)
  const substepsByParent = steps.reduce(
    (acc, step) => {
      if (step.parent) {
        if (!acc[step.parent]) {
          acc[step.parent] = []
        }
        acc[step.parent].push(step)
      }
      return acc
    },
    {} as Record<string, SidebarStep[]>,
  )

  const handleStepClick = (stepKey: string, step: SidebarStep) => {
    const state = getStepState(stepKey, completedSteps, activeStep, step, journey, deduplicationParent)
    // Only allow clicking on completed steps (to edit) or the active step
    if (state === 'completed') {
      // Pass the parent information to help identify which occurrence was clicked
      onStepClick(stepKey, step.parent)
    }
  }

  const renderStep = (
    step: SidebarStep,
    isSubstep: boolean = false,
    isLast: boolean = false,
    verticalLineHeight?: number,
  ) => {
    const state = getStepState(step.key, completedSteps, activeStep, step, journey, deduplicationParent)
    const isClickable = state === 'completed'

    return (
      <div key={step.key} className={cn('relative pl-1', isSubstep && 'pl-2')}>
        {/* Dynamic height vertical line for main steps with substeps */}
        {!isLast && !isSubstep && verticalLineHeight && (
          <div
            className="absolute left-[33px] top-[44px] w-0.5 bg-[var(--color-border-neutral-faded)] z-0"
            style={{ height: `${verticalLineHeight}px` }}
          />
        )}
        {/* Standard vertical line for steps without substeps */}
        {!isLast && !verticalLineHeight && !isSubstep && (
          <div className="absolute left-[33px] top-[44px] h-[24px] w-0.5 bg-[var(--color-border-neutral-faded)] z-0" />
        )}
        <button
          onClick={() => handleStepClick(step.key, step)}
          disabled={!isClickable}
          className={cn(
            'relative flex items-center gap-3 w-full py-2 px-3 rounded-md bg-transparent border-none cursor-default transition-all duration-150 ease-out text-left z-10',
            state === 'active' && 'bg-[var(--color-background-elevation-raised)]',
            state === 'completed' && 'opacity-100',
            state === 'pending' && 'opacity-60',
            isClickable && 'cursor-pointer hover:bg-[var(--color-background-neutral-faded)]',
          )}
        >
          <StepIcon state={state} stepKey={step.key} />
          <span
            className={cn(
              'text-sm font-medium text-content flex-1',
              state === 'pending' && 'text-[var(--color-foreground-neutral-faded)]',
              state === 'active' && 'font-semibold',
            )}
          >
            {step.title}
          </span>
          {state === 'active' && <span className="text-lg text-[var(--color-foreground-primary)] font-bold">›</span>}
        </button>
      </div>
    )
  }

  const renderStepWithSubsteps = (step: SidebarStep, index: number, totalTopLevel: number) => {
    const substeps = substepsByParent[step.key] || []
    const isLastTopLevel = index === totalTopLevel - 1
    const hasSubsteps = substeps.length > 0

    // Calculate vertical line height for main step: extend past all substeps to connect to next main step
    // Each step (including substeps) takes: ~60px (button with icon + padding + gap)
    // From parent icon bottom (44px) to next main step icon center:
    // - Gap to first substep: 8px
    // - Substeps: substeps.length * 60px
    // - Gap to next main step: 8px
    // - Next main step icon center: 26px
    const verticalLineHeight = hasSubsteps
      ? 8 + substeps.length * 60 + 8 + 8 // gap + substeps + gap + next icon edge to edge
      : undefined

    return (
      <React.Fragment key={step.key}>
        {/* Main step with continuous vertical line */}
        {renderStep(step, false, isLastTopLevel && !hasSubsteps, verticalLineHeight)}
        {hasSubsteps && (
          <div className="relative pl-10">
            {/* Horizontal connector line from main vertical line (at 33px) to substep icon center */}
            {/* Vertical line is at 33px from main container, substeps container starts at 0px with pl-10 (40px padding) */}
            {/* Horizontal line starts at vertical line position (33px from container start) */}
            {/* Substep icon center is at: 40px (container padding) + 29px (from substep div) = 69px from container start */}
            {/* So horizontal line: left-[33px], width = 69px - 33px = 36px */}
            <div className="absolute left-[33px] top-[26px] w-[27px] h-0.5 bg-[var(--color-border-neutral-faded)] z-0" />
            {substeps.map((substep, subIndex) =>
              renderStep(substep, true, isLastTopLevel && subIndex === substeps.length - 1),
            )}
          </div>
        )}
      </React.Fragment>
    )
  }

  return (
    <nav className="shrink-0 py-4 min-w-[320px]">
      <div className="flex flex-col gap-2">
        {topLevelSteps.map((step, index) => renderStepWithSubsteps(step, index, topLevelSteps.length))}
      </div>
    </nav>
  )
}

export default WizardSidebar
