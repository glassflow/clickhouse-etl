import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DeduplicationConfigurator } from './DeduplicationConfigurator'
import { StepKeys } from '@/src/config/constants'

const mockOnCompleteStep = vi.fn()
const mockOnCompleteStandaloneEditing = vi.fn()
const mockUpdateDeduplication = vi.fn()
const mockSkipDeduplication = vi.fn()
const mockGetDeduplication = vi.fn()
const mockGetTopic = vi.fn()
const mockMarkAsDirty = vi.fn()
const mockDiscardSection = vi.fn()
const mockOnSectionConfigured = vi.fn()
const mockDedupKey = vi.fn()
const mockDeduplicationKeyPage = vi.fn()

vi.mock('@/src/store', () => ({
  useStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      coreStore: {
        markAsDirty: mockMarkAsDirty,
        discardSection: mockDiscardSection,
      },
      topicsStore: { getTopic: mockGetTopic },
      deduplicationStore: {
        getDeduplication: mockGetDeduplication,
        updateDeduplication: mockUpdateDeduplication,
        skipDeduplication: mockSkipDeduplication,
      },
    }
    if (typeof selector === 'function') {
      return selector(state)
    }
    return state
  }),
}))

vi.mock('@/src/store/state-machine/validation-engine', () => ({
  useValidationEngine: () => ({
    onSectionConfigured: mockOnSectionConfigured,
  }),
}))

vi.mock('@/src/hooks/useJourneyAnalytics', () => ({
  useJourneyAnalytics: () => ({
    page: { deduplicationKey: mockDeduplicationKeyPage },
    key: { dedupKey: mockDedupKey },
  }),
}))

vi.mock('@/src/modules/deduplication/components/SelectDeduplicateKeys', () => ({
  __esModule: true,
  default: () => <div data-testid="select-deduplicate-keys" />,
}))

vi.mock('@/src/components/shared/EventEditor', () => ({
  EventEditor: () => <div data-testid="event-editor" />,
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

const defaultTopic = {
  name: 'my-topic',
  selectedEvent: { event: { id: 1, name: 'test' } },
}

describe('DeduplicationConfigurator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTopic.mockReturnValue(defaultTopic)
    mockGetDeduplication.mockReturnValue(undefined)
  })

  it('shows "No topic data available" when getTopic returns undefined', async () => {
    mockGetTopic.mockReturnValue(undefined)
    await act(async () => {
      render(<DeduplicationConfigurator onCompleteStep={mockOnCompleteStep} index={0} />)
    })
    expect(screen.getByText(/No topic data available for index 0/)).toBeInTheDocument()
  })

  it('shows "No event data available for topic" when topic has no selectedEvent.event', async () => {
    mockGetTopic.mockReturnValue({ name: 'my-topic', selectedEvent: { event: null } })
    await act(async () => {
      render(<DeduplicationConfigurator onCompleteStep={mockOnCompleteStep} index={0} />)
    })
    expect(
      screen.getByText(/No event data available for topic "my-topic"/),
    ).toBeInTheDocument()
  })

  it('renders main content and SelectDeduplicateKeys when topic and event are set', async () => {
    await act(async () => {
      render(<DeduplicationConfigurator onCompleteStep={mockOnCompleteStep} index={0} />)
    })
    expect(screen.getByTestId('select-deduplicate-keys')).toBeInTheDocument()
    expect(screen.getByTestId('event-editor')).toBeInTheDocument()
    expect(screen.getByTestId('form-actions')).toBeInTheDocument()
  })

  it('disables Continue when key/window/unit missing', async () => {
    mockGetDeduplication.mockReturnValue(undefined)
    await act(async () => {
      render(<DeduplicationConfigurator onCompleteStep={mockOnCompleteStep} index={0} />)
    })
    const continueBtn = screen.getByTestId('continue-btn')
    expect(continueBtn).toBeDisabled()
  })

  it('enables Continue when key, window, and unit are set', async () => {
    mockGetDeduplication.mockReturnValue({
      key: 'id',
      window: 1,
      unit: 'hours',
      keyType: 'string',
      enabled: true,
    })
    await act(async () => {
      render(<DeduplicationConfigurator onCompleteStep={mockOnCompleteStep} index={0} />)
    })
    const continueBtn = screen.getByTestId('continue-btn')
    expect(continueBtn).not.toBeDisabled()
  })

  it('on Continue click calls onSectionConfigured and onCompleteStep in creation mode', async () => {
    mockGetDeduplication.mockReturnValue({
      key: 'id',
      window: 1,
      unit: 'hours',
      keyType: 'string',
      enabled: true,
    })
    await act(async () => {
      render(<DeduplicationConfigurator onCompleteStep={mockOnCompleteStep} index={0} />)
    })
    const continueBtn = screen.getByTestId('continue-btn')
    await act(async () => {
      fireEvent.click(continueBtn)
    })
    expect(mockOnSectionConfigured).toHaveBeenCalledWith(StepKeys.DEDUPLICATION_CONFIGURATOR)
    expect(mockOnCompleteStep).toHaveBeenCalledWith(StepKeys.DEDUPLICATION_CONFIGURATOR)
  })

  it('on Continue click in standalone mode calls markAsDirty and onCompleteStandaloneEditing', async () => {
    mockGetDeduplication.mockReturnValue({
      key: 'id',
      window: 1,
      unit: 'hours',
      keyType: 'string',
      enabled: true,
    })
    const mockToggleEditMode = vi.fn()
    await act(async () => {
      render(
        <DeduplicationConfigurator
          onCompleteStep={mockOnCompleteStep}
          index={0}
          standalone
          toggleEditMode={mockToggleEditMode}
          onCompleteStandaloneEditing={mockOnCompleteStandaloneEditing}
        />,
      )
    })
    const continueBtn = screen.getByTestId('continue-btn')
    await act(async () => {
      fireEvent.click(continueBtn)
    })
    expect(mockOnSectionConfigured).toHaveBeenCalledWith(StepKeys.DEDUPLICATION_CONFIGURATOR)
    expect(mockMarkAsDirty).toHaveBeenCalled()
    expect(mockOnCompleteStandaloneEditing).toHaveBeenCalled()
    expect(mockOnCompleteStep).not.toHaveBeenCalled()
  })

  it('shows Skip button when not standalone', async () => {
    await act(async () => {
      render(<DeduplicationConfigurator onCompleteStep={mockOnCompleteStep} index={0} />)
    })
    expect(screen.getByRole('button', { name: /Skip Deduplication/i })).toBeInTheDocument()
  })

  it('hides Skip button when standalone', async () => {
    await act(async () => {
      render(
        <DeduplicationConfigurator
          onCompleteStep={mockOnCompleteStep}
          index={0}
          standalone
          toggleEditMode={vi.fn()}
        />,
      )
    })
    expect(screen.queryByRole('button', { name: /Skip Deduplication/i })).not.toBeInTheDocument()
  })

  it('on Skip click calls skipDeduplication and onCompleteStep', async () => {
    await act(async () => {
      render(<DeduplicationConfigurator onCompleteStep={mockOnCompleteStep} index={0} />)
    })
    const skipBtn = screen.getByRole('button', { name: /Skip Deduplication/i })
    await act(async () => {
      fireEvent.click(skipBtn)
    })
    expect(mockSkipDeduplication).toHaveBeenCalledWith(0)
    expect(mockOnSectionConfigured).toHaveBeenCalledWith(StepKeys.DEDUPLICATION_CONFIGURATOR)
    expect(mockOnCompleteStep).toHaveBeenCalledWith(StepKeys.DEDUPLICATION_CONFIGURATOR)
  })

  it('on Discard click calls discardSection with deduplication', async () => {
    await act(async () => {
      render(<DeduplicationConfigurator onCompleteStep={mockOnCompleteStep} index={0} />)
    })
    const discardBtn = screen.getByTestId('discard-btn')
    await act(async () => {
      fireEvent.click(discardBtn)
    })
    expect(mockDiscardSection).toHaveBeenCalledWith('deduplication')
  })

  it('renders schema modification notice when schema has added and removed fields', async () => {
    mockGetTopic.mockReturnValue({
      name: 'my-topic',
      selectedEvent: { event: { id: 1 } },
      schema: {
        fields: [
          { name: 'id', isManuallyAdded: false, isRemoved: false },
          { name: 'extra', isManuallyAdded: true, isRemoved: false },
          { name: 'old', isManuallyAdded: false, isRemoved: true },
        ],
      },
    })
    await act(async () => {
      render(<DeduplicationConfigurator onCompleteStep={mockOnCompleteStep} index={0} />)
    })
    expect(screen.getByText(/Schema modified:/)).toBeInTheDocument()
    expect(screen.getByText(/1 field added/)).toBeInTheDocument()
    expect(screen.getByText(/1 field removed/)).toBeInTheDocument()
  })
})
