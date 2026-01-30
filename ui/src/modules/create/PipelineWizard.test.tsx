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
})
