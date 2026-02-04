import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PipelineDetailsModule from './PipelineDetailsModule'
import { createMockPipeline } from './__tests__/test-helpers'
import { StepKeys } from '@/src/config/constants'

const mockPush = vi.fn()
const mockSetViewBySection = vi.fn()
const mockSetViewByStep = vi.fn()
const mockCloseStep = vi.fn()
const mockReportStop = vi.fn()
const mockReportResume = vi.fn()
const mockReportTerminate = vi.fn()

const defaultActiveViewState = {
  activeStep: null as StepKeys | null,
  activeSection: 'monitor' as const,
  activeTopicIndex: 0,
  setViewBySection: mockSetViewBySection,
  setViewByStep: mockSetViewByStep,
  closeStep: mockCloseStep,
  setActiveStep: vi.fn(),
  setActiveSection: vi.fn(),
  setActiveTopicIndex: vi.fn(),
}

const mockUseActiveViewState = vi.fn(() => defaultActiveViewState)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
}))

vi.mock('./hooks/useActiveViewState', () => ({
  useActiveViewState: (...args: unknown[]) => mockUseActiveViewState(...args),
}))

vi.mock('@/src/hooks/usePipelineActions', () => ({
  usePipelineActions: () => ({
    actionState: { isLoading: false, error: null, lastAction: null },
    executeAction: vi.fn(),
  }),
}))

vi.mock('@/src/hooks/usePipelineStateAdapter', () => ({
  usePipelineOperations: () => ({
    reportStop: mockReportStop,
    reportResume: mockReportResume,
    reportTerminate: mockReportTerminate,
  }),
}))

const mockStoreState = {
  kafkaStore: { validation: { valid: true } },
  clickhouseConnectionStore: { validation: { valid: true } },
  clickhouseDestinationStore: { validation: { valid: true } },
  joinStore: { validation: { valid: true } },
  topicsStore: { validation: { valid: true } },
  deduplicationStore: { validation: { valid: true } },
  coreStore: { mode: 'view' },
}

vi.mock('@/src/store', () => ({
  useStore: (selector?: (state: unknown) => unknown) => {
    if (typeof selector === 'function') {
      return selector(mockStoreState)
    }
    return mockStoreState
  },
}))

vi.mock('@/src/hooks/usePipelineHydration', () => ({
  usePipelineHydration: () => ({ clearHydrationCache: vi.fn() }),
}))

vi.mock('@/src/utils/common.client', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  isDemoMode: () => false,
}))

vi.mock('@/src/api/pipeline-api', () => ({
  getPipeline: vi.fn(),
  updatePipelineMetadata: vi.fn(),
}))

vi.mock('@/src/notifications/api-error-handler', () => ({
  handleApiError: vi.fn(),
}))

vi.mock('@/src/notifications', () => ({
  notify: vi.fn(),
}))

vi.mock('./PipelineDetailsHeader', () => ({
  default: ({ pipeline, onPipelineDeleted }: { pipeline: { name: string }; onPipelineDeleted: () => void }) => (
    <div data-testid="pipeline-details-header">
      <span data-testid="header-pipeline-name">{pipeline.name}</span>
      <button type="button" onClick={onPipelineDeleted} data-testid="delete-pipeline">
        Delete
      </button>
    </div>
  ),
}))

vi.mock('./PipelineDetailsSidebar', () => ({
  PipelineDetailsSidebar: ({
    onSectionClick,
    disabled,
  }: {
    onSectionClick: (section: string) => void;
    disabled: boolean;
  }) => (
    <aside data-testid="pipeline-details-sidebar" data-disabled={disabled}>
      <button type="button" onClick={() => onSectionClick('monitor')} data-testid="section-monitor">
        Monitor
      </button>
      <button type="button" onClick={() => onSectionClick('kafka-connection')} data-testid="section-kafka">
        Kafka
      </button>
    </aside>
  ),
}))

vi.mock('./PipelineStatusOverviewSection', () => ({
  default: () => <div data-testid="status-overview-section">Status Overview</div>,
}))

vi.mock('./sections/KafkaConnectionSection', () => ({
  KafkaConnectionSection: ({
    onStepClick,
    disabled,
  }: {
    onStepClick: (step: StepKeys) => void;
    disabled: boolean;
  }) => (
    <div data-testid="kafka-connection-section" data-disabled={disabled}>
      <button type="button" onClick={() => onStepClick(StepKeys.KAFKA_CONNECTION)} data-testid="step-kafka">
        Kafka Connection
      </button>
    </div>
  ),
}))

vi.mock('./sections/TransformationSection', () => ({
  default: () => <div data-testid="transformation-section">Transformation</div>,
}))

vi.mock('./sections/ClickhouseConnectionSection', () => ({
  ClickhouseConnectionSection: () => <div data-testid="clickhouse-connection-section">ClickHouse</div>,
}))

vi.mock('./StandaloneStepRenderer', () => ({
  default: ({
    stepKey,
    onClose,
  }: {
    stepKey: string;
    onClose: () => void;
  }) => (
    <div data-testid="standalone-step-renderer" data-step-key={stepKey}>
      <button type="button" onClick={onClose} data-testid="close-step">
        Close
      </button>
    </div>
  ),
}))

vi.mock('@/src/modules/pipelines/components/PipelineTagsModal', () => ({
  default: ({
    visible,
    onSave,
    onCancel,
  }: {
    visible: boolean;
    onSave: (tags: string[]) => void;
    onCancel: () => void;
  }) =>
    visible ? (
      <div data-testid="tags-modal">
        <button type="button" onClick={() => onSave(['tag1'])} data-testid="tags-save">
          Save
        </button>
        <button type="button" onClick={onCancel} data-testid="tags-cancel">
          Cancel
        </button>
      </div>
    ) : null,
}))

describe('PipelineDetailsModule', () => {
  const pipeline = createMockPipeline({ name: 'My Pipeline' })

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseActiveViewState.mockImplementation(() => defaultActiveViewState)
  })

  it('renders with initial pipeline and shows main layout', () => {
    render(<PipelineDetailsModule pipeline={pipeline} />)

    expect(screen.getByTestId('pipeline-details-header')).toBeInTheDocument()
    expect(screen.getByTestId('pipeline-details-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('header-pipeline-name')).toHaveTextContent('My Pipeline')
  })

  it('renders monitor view when activeSection is monitor (default)', () => {
    render(<PipelineDetailsModule pipeline={pipeline} />)

    expect(screen.getByTestId('status-overview-section')).toBeInTheDocument()
    expect(screen.getByTestId('kafka-connection-section')).toBeInTheDocument()
    expect(screen.getByTestId('transformation-section')).toBeInTheDocument()
    expect(screen.getByTestId('clickhouse-connection-section')).toBeInTheDocument()
    expect(screen.queryByTestId('standalone-step-renderer')).not.toBeInTheDocument()
  })

  it('calls setViewBySection when sidebar section is clicked', () => {
    render(<PipelineDetailsModule pipeline={pipeline} />)

    fireEvent.click(screen.getByTestId('section-kafka'))

    expect(mockSetViewBySection).toHaveBeenCalledWith('kafka-connection', pipeline)
  })

  it('calls setViewByStep when Kafka step is clicked', () => {
    render(<PipelineDetailsModule pipeline={pipeline} />)

    fireEvent.click(screen.getByTestId('step-kafka'))

    expect(mockSetViewByStep).toHaveBeenCalledWith(StepKeys.KAFKA_CONNECTION, pipeline, undefined)
  })

  it('calls router.push(/pipelines) when pipeline is deleted', () => {
    render(<PipelineDetailsModule pipeline={pipeline} />)

    fireEvent.click(screen.getByTestId('delete-pipeline'))

    expect(mockPush).toHaveBeenCalledWith('/pipelines')
  })

  it('renders StandaloneStepRenderer when activeStep is set', () => {
    mockUseActiveViewState.mockReturnValue({
      ...defaultActiveViewState,
      activeStep: StepKeys.KAFKA_CONNECTION,
      activeSection: 'kafka-connection',
    })

    render(<PipelineDetailsModule pipeline={pipeline} />)

    expect(screen.getByTestId('standalone-step-renderer')).toBeInTheDocument()
    expect(screen.getByTestId('standalone-step-renderer')).toHaveAttribute(
      'data-step-key',
      StepKeys.KAFKA_CONNECTION
    )
  })

  it('calls closeStep when StandaloneStepRenderer close button is clicked', () => {
    mockUseActiveViewState.mockReturnValue({
      ...defaultActiveViewState,
      activeStep: StepKeys.KAFKA_CONNECTION,
      activeSection: 'kafka-connection',
    })

    render(<PipelineDetailsModule pipeline={pipeline} />)

    fireEvent.click(screen.getByTestId('close-step'))

    expect(mockCloseStep).toHaveBeenCalled()
  })
})
