import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StepKeys } from '@/src/config/constants'
import { WizardSidebar, type SidebarStep } from './WizardSidebar'

vi.mock('./wizard-step-icons', () => ({
  getStepIcon: () => () => <span data-testid="step-icon" />,
  CompletedCheckIcon: () => <span data-testid="completed-icon" />,
  stepIcons: {},
}))

const makeSteps = (): SidebarStep[] => [
  { id: 'step-1', key: StepKeys.KAFKA_CONNECTION, title: 'Kafka Connection', parent: null },
  { id: 'step-2', key: StepKeys.TOPIC_SELECTION_1, title: 'Select Topic', parent: null },
  { id: 'step-3', key: StepKeys.CLICKHOUSE_CONNECTION, title: 'ClickHouse Connection', parent: null },
]

describe('WizardSidebar', () => {
  it('renders all top-level steps with their titles', () => {
    const steps = makeSteps()
    render(
      <WizardSidebar
        steps={steps}
        completedStepIds={[]}
        activeStepId="step-1"
        onStepClick={vi.fn()}
      />,
    )
    expect(screen.getByText('Kafka Connection')).toBeInTheDocument()
    expect(screen.getByText('Select Topic')).toBeInTheDocument()
    expect(screen.getByText('ClickHouse Connection')).toBeInTheDocument()
  })

  it('calls onStepClick with step id when a completed step is clicked', () => {
    const steps = makeSteps()
    const onStepClick = vi.fn()
    render(
      <WizardSidebar
        steps={steps}
        completedStepIds={['step-1']}
        activeStepId="step-2"
        onStepClick={onStepClick}
      />,
    )
    const step1Button = screen.getByRole('button', { name: /Kafka Connection/i })
    fireEvent.click(step1Button)
    expect(onStepClick).toHaveBeenCalledTimes(1)
    expect(onStepClick).toHaveBeenCalledWith('step-1')
  })

  it('does not call onStepClick when active or pending step is clicked', () => {
    const steps = makeSteps()
    const onStepClick = vi.fn()
    render(
      <WizardSidebar
        steps={steps}
        completedStepIds={[]}
        activeStepId="step-2"
        onStepClick={onStepClick}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Kafka Connection/i }))
    fireEvent.click(screen.getByRole('button', { name: /Select Topic/i }))
    fireEvent.click(screen.getByRole('button', { name: /ClickHouse Connection/i }))
    expect(onStepClick).not.toHaveBeenCalled()
  })

  it('disables buttons for non-completed steps', () => {
    const steps = makeSteps()
    render(
      <WizardSidebar
        steps={steps}
        completedStepIds={['step-1']}
        activeStepId="step-2"
        onStepClick={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Kafka Connection/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Select Topic/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /ClickHouse Connection/i })).toBeDisabled()
  })

  it('renders substeps under their parent when steps have parent', () => {
    const stepsWithSubsteps: SidebarStep[] = [
      { id: 'main-1', key: StepKeys.KAFKA_TYPE_VERIFICATION, title: 'Verify Types', parent: null },
      { id: 'sub-1', key: StepKeys.DEDUPLICATION_CONFIGURATOR, title: 'Deduplicate', parent: StepKeys.KAFKA_TYPE_VERIFICATION },
    ]
    render(
      <WizardSidebar
        steps={stepsWithSubsteps}
        completedStepIds={[]}
        activeStepId="main-1"
        onStepClick={vi.fn()}
      />,
    )
    expect(screen.getByText('Verify Types')).toBeInTheDocument()
    expect(screen.getByText('Deduplicate')).toBeInTheDocument()
  })
})
