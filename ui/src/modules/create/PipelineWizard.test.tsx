import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import PipelineWizard from './PipelineWizard'
import { useStore } from '@/src/store'
import { getWizardJourneyInstances } from './utils'
import { StepKeys } from '@/src/config/constants'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('./wizard-step-icons', () => ({
  getStepIcon: () => () => <span data-testid="step-icon" />,
  CompletedCheckIcon: () => <span data-testid="completed-icon" />,
  stepIcons: {},
}))

vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>()
  const MockStep = ({ onCompleteStep }: { onCompleteStep: () => void }) => (
    <button type="button" data-testid="wizard-step-next" onClick={onCompleteStep}>
      Next
    </button>
  )
  return {
    ...actual,
    getWizardJourneySteps: (topicCount: number | undefined) => {
      const map = actual.getWizardJourneySteps(topicCount)
      return Object.fromEntries(Object.keys(map).map((key) => [key, MockStep]))
    },
  }
})

describe('PipelineWizard', () => {
  beforeEach(() => {
    mockPush.mockClear()
    useStore.getState().resetForNewPipeline(1)
  })

  const markAllWizardSlicesValid = () => {
    const state: any = useStore.getState()
    state.kafkaStore?.markAsValid?.()
    state.topicsStore?.markAsValid?.()
    state.deduplicationStore?.markAsValid?.()
    state.filterStore?.markAsValid?.()
    state.transformationStore?.markAsValid?.()
    state.joinStore?.markAsValid?.()
    state.clickhouseConnectionStore?.markAsValid?.()
    state.clickhouseDestinationStore?.markAsValid?.()
  }

  it('redirects to home when topicCount is invalid', async () => {
    useStore.getState().coreStore.setTopicCount(0)
    await act(async () => {
      render(<PipelineWizard />)
    })
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('syncs activeStepId to first step when not set', async () => {
    useStore.getState().coreStore.setTopicCount(1)
    useStore.getState().stepsStore.resetStepsStore()
    const firstStepId = getWizardJourneyInstances(1)[0].id

    await act(async () => {
      render(<PipelineWizard />)
    })

    expect(useStore.getState().stepsStore.activeStepId).toBe(firstStepId)
  })

  it('calls addCompletedStepId and setActiveStepId on Next (handleNext)', async () => {
    useStore.getState().coreStore.setTopicCount(1)
    const journey = getWizardJourneyInstances(1)
    const firstId = journey[0].id
    const secondId = journey[1].id
    useStore.getState().stepsStore.setActiveStepId(firstId)

    await act(async () => {
      render(<PipelineWizard />)
    })

    const nextButton = screen.getByTestId('wizard-step-next')
    await act(async () => {
      fireEvent.click(nextButton)
    })

    expect(useStore.getState().stepsStore.completedStepIds).toContain(firstId)
    expect(useStore.getState().stepsStore.activeStepId).toBe(secondId)
  })

  it('navigates to /pipelines/ when Next on REVIEW_CONFIGURATION step', async () => {
    useStore.getState().coreStore.setTopicCount(1)
    const journey = getWizardJourneyInstances(1)
    const reviewIndex = journey.findIndex((i) => i.key === StepKeys.REVIEW_CONFIGURATION)
    if (reviewIndex === -1) return
    const reviewId = journey[reviewIndex].id
    useStore.getState().stepsStore.setActiveStepId(reviewId)
    useStore.getState().stepsStore.setCompletedStepIds(
      journey.slice(0, reviewIndex).map((i) => i.id),
    )

    await act(async () => {
      render(<PipelineWizard />)
    })

    const nextButton = screen.getByTestId('wizard-step-next')
    await act(async () => {
      fireEvent.click(nextButton)
    })

    expect(mockPush).toHaveBeenCalledWith('/pipelines/')
  })

  it('handleSidebarStepClick sets activeStepId when clicking a completed step', async () => {
    useStore.getState().coreStore.setTopicCount(1)
    const journey = getWizardJourneyInstances(1)
    const firstId = journey[0].id
    const secondId = journey[1].id
    useStore.getState().stepsStore.setActiveStepId(secondId)
    useStore.getState().stepsStore.addCompletedStepId(firstId)

    await act(async () => {
      render(<PipelineWizard />)
    })

    const sidebarStep1 = screen.getByRole('button', { name: /Kafka Connection/i })
    await act(async () => {
      fireEvent.click(sidebarStep1)
    })

    expect(useStore.getState().stepsStore.activeStepId).toBe(firstId)
  })

  it('resumes to the last editing step when returning to a previous completed step (non-destructive)', async () => {
    useStore.getState().coreStore.setTopicCount(1)
    markAllWizardSlicesValid()

    const journey = getWizardJourneyInstances(1)
    const firstId = journey[0].id
    const resumeIdx = Math.min(3, Math.max(1, journey.length - 1))
    const resumeId = journey[resumeIdx].id

    useStore.getState().stepsStore.setActiveStepId(resumeId)
    useStore.getState().stepsStore.setCompletedStepIds(journey.slice(0, resumeIdx).map((i) => i.id))

    await act(async () => {
      render(<PipelineWizard />)
    })

    const sidebarStep1 = screen.getByRole('button', { name: /Kafka Connection/i })
    await act(async () => {
      fireEvent.click(sidebarStep1)
    })
    expect(useStore.getState().stepsStore.activeStepId).toBe(firstId)

    const nextButton = screen.getByTestId('wizard-step-next')
    await act(async () => {
      fireEvent.click(nextButton)
    })

    // Should jump back to where user left off, not step-by-step forward.
    expect(useStore.getState().stepsStore.activeStepId).toBe(resumeId)
    expect(useStore.getState().stepsStore.resumeStepId).toBe(null)
  })

  it('routes to earliest invalidated downstream step and prunes completed steps (destructive change)', async () => {
    useStore.getState().coreStore.setTopicCount(1)
    markAllWizardSlicesValid()

    const journey = getWizardJourneyInstances(1)
    const firstId = journey[0].id

    const resumeIdx = journey.findIndex((i) => i.key === StepKeys.CLICKHOUSE_CONNECTION)
    if (resumeIdx === -1) return
    const resumeId = journey[resumeIdx].id

    // Simulate user having progressed to a later step.
    useStore.getState().stepsStore.setActiveStepId(resumeId)
    useStore.getState().stepsStore.setCompletedStepIds(journey.slice(0, resumeIdx).map((i) => i.id))

    await act(async () => {
      render(<PipelineWizard />)
    })

    // Go back to Kafka Connection via sidebar (sets resumeStepId internally).
    const sidebarStep1 = screen.getByRole('button', { name: /Kafka Connection/i })
    await act(async () => {
      fireEvent.click(sidebarStep1)
    })
    expect(useStore.getState().stepsStore.activeStepId).toBe(firstId)

    // Destructive change: invalidate deduplication (a downstream step).
    await act(async () => {
      useStore.getState().deduplicationStore.markAsInvalidated('topic-changed')
    })

    const expectedBlockingIdx = journey.findIndex((i) => i.key === StepKeys.DEDUPLICATION_CONFIGURATOR)
    if (expectedBlockingIdx === -1) return
    const expectedBlockingId = journey[expectedBlockingIdx].id

    const nextButton = screen.getByTestId('wizard-step-next')
    await act(async () => {
      fireEvent.click(nextButton)
    })

    // Should jump directly to the earliest invalidated step, not resume target.
    expect(useStore.getState().stepsStore.activeStepId).toBe(expectedBlockingId)
    expect(useStore.getState().stepsStore.completedStepIds).not.toContain(resumeId)
  })
})
