'use client'

import React from 'react'
import { StepKeys } from '@/src/config/constants'
import { cn } from '@/src/utils/common.client'
import { getStepIcon, CompletedCheckIcon } from './wizard-step-icons'

export interface SidebarStep {
  id: string
  key: StepKeys
  title: string
  parent?: StepKeys | null // null means top-level step
}

interface WizardSidebarProps {
  steps: SidebarStep[]
  completedStepIds: string[]
  activeStepId: string | null
  onStepClick: (stepInstanceId: string) => void
}

type StepState = 'pending' | 'active' | 'completed'

function getStepState(
  stepId: string,
  completedStepIds: string[],
  activeStepId: string | null,
): StepState {
  if (completedStepIds.includes(stepId)) {
    return 'completed'
  }
  if (activeStepId === stepId) {
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
  completedStepIds,
  activeStepId,
  onStepClick,
}: WizardSidebarProps) {
  // Separate top-level steps and substeps
  const topLevelSteps = steps.filter((step) => !step.parent)

  // Detect if this is a multi-topic journey (has topic-selection-2)
  const isMultiTopicJourney = topLevelSteps.some((step) => step.key === 'topic-selection-2')

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

  const handleStepClick = (step: SidebarStep) => {
    const state = getStepState(step.id, completedStepIds, activeStepId)
    if (state === 'completed') {
      onStepClick(step.id)
    }
  }

  const renderStep = (
    step: SidebarStep,
    isSubstep: boolean = false,
    isLast: boolean = false,
    verticalLineHeight?: number,
  ) => {
    const state = getStepState(step.id, completedStepIds, activeStepId)
    const isClickable = state === 'completed'

    return (
      <div key={step.id} className={cn('relative pl-1', isSubstep && 'pl-2')}>
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
          onClick={() => handleStepClick(step)}
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
    // Each substep button takes: 52px (36px icon + 8px py-2 top + 8px py-2 bottom)
    // From parent icon bottom (44px) to next main step icon edge:
    // - Gap to substeps container: 8px
    // - Substeps: substeps.length * height (no gap between substeps inside container)
    // - Gap to next main step: 8px
    // - To next main step icon top edge: 8px
    // Multi-topic journey has more flex gaps accumulating, requiring 60px increment
    // Single-topic journey uses 56px increment
    const substepHeightIncrement = isMultiTopicJourney ? 60 : 56
    const verticalLineHeight = hasSubsteps
      ? 8 + substeps.length * substepHeightIncrement + 8 + 8 // gap + substeps + gap + next icon edge
      : undefined

    return (
      <React.Fragment key={step.id}>
        {/* Main step with continuous vertical line */}
        {renderStep(step, false, isLastTopLevel && !hasSubsteps, verticalLineHeight)}
        {hasSubsteps && (
          <div className="relative pl-10">
            {/* Horizontal connector line from main vertical line (at 33px) to substep icon center */}
            {/* Vertical line is at 33px from main container, substeps container starts at 0px with pl-10 (40px padding) */}
            {/* Horizontal line starts at vertical line position (33px from container start) */}
            {/* Substep icon center is at: 40px (container padding) + 29px (from substep div) = 69px from container start */}
            {/* So horizontal line: left-[33px], width = 69px - 33px = 36px */}
            {substeps.map((substep, subIndex) => {
              // Each substep button is 52px tall (36px icon + 8px padding top + 8px padding bottom)
              // Horizontal lines align with icon centers within the substeps container
              // First substep: 26px (center of icon), subsequent ones: 26px + (index * 52px)
              const horizontalLineTop = 26 + subIndex * 52
              return (
                <React.Fragment key={substep.id}>
                  <div
                    className="absolute left-[33px] w-[27px] h-0.5 bg-[var(--color-border-neutral-faded)] z-0"
                    style={{ top: `${horizontalLineTop}px` }}
                  />
                  {renderStep(substep, true, isLastTopLevel && subIndex === substeps.length - 1)}
                </React.Fragment>
              )
            })}
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
