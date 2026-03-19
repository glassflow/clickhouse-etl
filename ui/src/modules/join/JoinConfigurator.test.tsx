import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { JoinConfigurator } from './JoinConfigurator'
import { StepKeys } from '@/src/config/constants'

const mockOnCompleteStep = vi.fn()
const mockOnCompleteStandaloneEditing = vi.fn()
const mockGetTopic = vi.fn()
const mockSetEnabled = vi.fn()
const mockSetType = vi.fn()
const mockSetStreams = vi.fn()
const mockMarkAsDirty = vi.fn()
const mockDiscardSection = vi.fn()
const mockOnSectionConfigured = vi.fn()
const mockInvalidateSection = vi.fn()
const mockJoinPageKey = vi.fn()
const mockJoinConfigurationStarted = vi.fn()
const mockJoinFieldChanged = vi.fn()
const mockJoinConfigurationCompleted = vi.fn()
const mockLeftJoinKey = vi.fn()
const mockRightJoinKey = vi.fn()
const mockNotify = vi.fn()

const mockUseStore = vi.fn()

vi.mock('@/src/store', () => ({
  useStore: () => mockUseStore(),
}))

vi.mock('@/src/store/state-machine/validation-engine', () => ({
  useValidationEngine: () => ({
    onSectionConfigured: mockOnSectionConfigured,
    invalidateSection: mockInvalidateSection,
  }),
}))

vi.mock('@/src/hooks/useJourneyAnalytics', () => ({
  useJourneyAnalytics: () => ({
    page: { joinKey: mockJoinPageKey },
    join: {
      configurationStarted: mockJoinConfigurationStarted,
      fieldChanged: mockJoinFieldChanged,
      configurationCompleted: mockJoinConfigurationCompleted,
    },
    key: {
      leftJoinKey: mockLeftJoinKey,
      rightJoinKey: mockRightJoinKey,
    },
  }),
}))

vi.mock('@/src/notifications', () => ({
  notify: (msg: string) => mockNotify(msg),
}))

vi.mock('uuid', () => ({
  v4: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
}))

vi.mock('@/src/utils/common.client', () => ({
  extractEventFields: () => ['id', 'userId'],
}))

vi.mock('./components/StreamConfiguratorList', () => ({
  StreamConfiguratorList: ({
    streams,
    onChange,
    errors,
  }: {
    streams: { joinKey: string; joinTimeWindowValue: number; joinTimeWindowUnit: string }[]
    onChange: (streamIndex: number, field: string, value: unknown) => void
    errors: Record<string, string>
  }) => (
    <div data-testid="stream-configurator-list">
      {streams.map((_, i) => (
        <div key={i}>
          <button
            type="button"
            data-testid={`set-stream-${i}-joinKey`}
            onClick={() => onChange(i, 'joinKey', 'id')}
          >
            Set joinKey
          </button>
          <button
            type="button"
            data-testid={`set-stream-${i}-joinTimeWindowValue`}
            onClick={() => onChange(i, 'joinTimeWindowValue', 1)}
          >
            Set value
          </button>
          <button
            type="button"
            data-testid={`set-stream-${i}-joinTimeWindowUnit`}
            onClick={() => onChange(i, 'joinTimeWindowUnit', 'minutes')}
          >
            Set unit
          </button>
        </div>
      ))}
      <pre data-testid="errors">{JSON.stringify(errors)}</pre>
    </div>
  ),
}))

vi.mock('@/src/components/shared/FormActions', () => ({
  __esModule: true,
  default: ({
    onSubmit,
    onDiscard,
    disabled,
    regularText,
  }: {
    onSubmit: () => void
    onDiscard: () => void
    disabled: boolean
    regularText: string
  }) => (
    <div data-testid="form-actions">
      <button type="button" data-testid="continue-btn" onClick={onSubmit} disabled={disabled}>
        {regularText}
      </button>
      <button type="button" data-testid="discard-btn" onClick={onDiscard}>
        Discard
      </button>
    </div>
  ),
}))

const defaultTopic1 = {
  name: 'topic1',
  events: [{ event: { id: 1, userId: 'a' } }],
  selectedEvent: { event: { id: 1, userId: 'a' } },
}
const defaultTopic2 = {
  name: 'topic2',
  events: [{ event: { id: 2, userId: 'b' } }],
  selectedEvent: { event: { id: 2, userId: 'b' } },
}

const defaultProps = {
  steps: {},
  onCompleteStep: mockOnCompleteStep,
  validate: () => true,
  index: 0,
}

const defaultStoreState = {
  topicsStore: { getTopic: mockGetTopic },
  joinStore: {
    enabled: false,
    type: 'temporal',
    streams: [] as any[],
    setEnabled: mockSetEnabled,
    setType: mockSetType,
    setStreams: mockSetStreams,
  },
  coreStore: {
    markAsDirty: mockMarkAsDirty,
    discardSection: mockDiscardSection,
  },
}
const defaultStore = () => defaultStoreState

describe('JoinConfigurator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTopic.mockImplementation((i: number) => (i === 0 ? defaultTopic1 : defaultTopic2))
    mockUseStore.mockImplementation(defaultStore)
  })

  it('renders StreamConfiguratorList and FormActions when both topics exist', async () => {
    await act(async () => {
      render(<JoinConfigurator {...defaultProps} />)
    })
    expect(screen.getByTestId('stream-configurator-list')).toBeInTheDocument()
    expect(screen.getByTestId('form-actions')).toBeInTheDocument()
  })

  it('disables Continue when form is incomplete', async () => {
    await act(async () => {
      render(<JoinConfigurator {...defaultProps} />)
    })
    const continueBtn = screen.getByTestId('continue-btn')
    expect(continueBtn).toBeDisabled()
  })

  it('disables Continue when form is incomplete so submit does not update store', async () => {
    await act(async () => {
      render(<JoinConfigurator {...defaultProps} />)
    })
    const continueBtn = screen.getByTestId('continue-btn')
    expect(continueBtn).toBeDisabled()
    expect(mockSetStreams).not.toHaveBeenCalled()
  })

  const preFilledStoreState = {
    topicsStore: { getTopic: mockGetTopic },
    joinStore: {
      enabled: true,
      type: 'temporal',
      streams: [
        {
          streamId: 't1_abc',
          topicName: 'topic1',
          joinKey: 'userId',
          joinTimeWindowValue: 1,
          joinTimeWindowUnit: 'minutes',
          orientation: 'left' as const,
        },
        {
          streamId: 't2_def',
          topicName: 'topic2',
          joinKey: 'userId',
          joinTimeWindowValue: 1,
          joinTimeWindowUnit: 'minutes',
          orientation: 'right' as const,
        },
      ],
      setEnabled: mockSetEnabled,
      setType: mockSetType,
      setStreams: mockSetStreams,
    },
    coreStore: {
      markAsDirty: mockMarkAsDirty,
      discardSection: mockDiscardSection,
    },
  }

  it('when streams are pre-filled from store, canContinue is true and Submit updates store', async () => {
    mockGetTopic.mockImplementation((i: number) => (i === 0 ? defaultTopic1 : defaultTopic2))
    mockUseStore.mockReturnValue(preFilledStoreState)

    await act(async () => {
      render(<JoinConfigurator {...defaultProps} />)
    })
    const continueBtn = screen.getByTestId('continue-btn')
    expect(continueBtn).not.toBeDisabled()
    await act(async () => {
      fireEvent.click(continueBtn)
    })
    expect(mockSetEnabled).toHaveBeenCalledWith(true)
    expect(mockSetType).toHaveBeenCalledWith('temporal')
    expect(mockSetStreams).toHaveBeenCalled()
    expect(mockOnSectionConfigured).toHaveBeenCalledWith(StepKeys.JOIN_CONFIGURATOR)
    expect(mockOnCompleteStep).toHaveBeenCalledWith(StepKeys.JOIN_CONFIGURATOR)
  })

  it('in standalone mode on Submit calls markAsDirty and onCompleteStandaloneEditing', async () => {
    mockGetTopic.mockImplementation((i: number) => (i === 0 ? defaultTopic1 : defaultTopic2))
    mockUseStore.mockReturnValue(preFilledStoreState)

    await act(async () => {
      render(
        <JoinConfigurator
          {...defaultProps}
          standalone
          onCompleteStandaloneEditing={mockOnCompleteStandaloneEditing}
        />,
      )
    })
    const continueBtn = screen.getByTestId('continue-btn')
    await act(async () => {
      fireEvent.click(continueBtn)
    })
    expect(mockMarkAsDirty).toHaveBeenCalled()
    expect(mockOnCompleteStandaloneEditing).toHaveBeenCalled()
    expect(mockOnCompleteStep).not.toHaveBeenCalled()
  })

  it('on Discard click calls discardSection with join', async () => {
    await act(async () => {
      render(<JoinConfigurator {...defaultProps} />)
    })
    const discardBtn = screen.getByTestId('discard-btn')
    await act(async () => {
      fireEvent.click(discardBtn)
    })
    expect(mockDiscardSection).toHaveBeenCalledWith('join')
  })
})
