import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { KafkaTypeVerification } from './KafkaTypeVerification'
import { StepKeys } from '@/src/config/constants'

const mockOnCompleteStep = vi.fn()
const mockUpdateTopic = vi.fn()
const mockOnSectionConfigured = vi.fn()
const mockMarkAsDirty = vi.fn()
const mockOnCompleteStandaloneEditing = vi.fn()
const mockDiscardSection = vi.fn()

vi.mock('@/src/store', () => ({
  useStore: vi.fn(),
}))

vi.mock('@/src/store/state-machine/validation-engine', () => ({
  useValidationEngine: () => ({
    onSectionConfigured: mockOnSectionConfigured,
  }),
}))

vi.mock('@/src/modules/kafka/hooks/useTypeVerificationState', () => ({
  useTypeVerificationState: () => ({
    fieldTypes: [
      { name: 'id', inferredType: 'int32', userType: 'int32', isManuallyAdded: false, isRemoved: false },
      { name: 'name', inferredType: 'string', userType: 'string', isManuallyAdded: false, isRemoved: false },
    ],
    newFieldName: '',
    newFieldType: 'string',
    newFieldError: null,
    setNewFieldName: vi.fn(),
    setNewFieldType: vi.fn(),
    clearNewFieldError: vi.fn(),
    handleTypeChange: vi.fn(),
    handleAddField: vi.fn(),
    handleRemoveField: vi.fn(),
    handleRestoreField: vi.fn(),
    canContinue: true,
  }),
}))

vi.mock('@/src/modules/kafka/components/FieldTypesTable', () => ({
  FieldTypesTable: () => <div data-testid="field-types-table" />,
}))

vi.mock('@/src/components/shared/FormActions', () => ({
  __esModule: true,
  default: ({
    onSubmit,
    onDiscard,
    regularText,
  }: {
    onSubmit: () => void
    onDiscard: () => void
    regularText: string
  }) => (
    <div data-testid="form-actions">
      <button type="button" data-testid="confirm-types-btn" onClick={onSubmit}>
        {regularText}
      </button>
      <button type="button" data-testid="discard-btn" onClick={onDiscard}>
        Discard
      </button>
    </div>
  ),
}))

import { useStore } from '@/src/store'

describe('KafkaTypeVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useStore).mockReturnValue({
      topicsStore: {
        getTopic: vi.fn(),
        updateTopic: mockUpdateTopic,
      },
      coreStore: {
        markAsDirty: mockMarkAsDirty,
        discardSection: mockDiscardSection,
      },
    } as ReturnType<typeof useStore>)
  })

  it('shows "No topic data available" when getTopic returns undefined', async () => {
    vi.mocked(useStore).mockReturnValue({
      topicsStore: { getTopic: () => undefined, updateTopic: mockUpdateTopic },
      coreStore: { markAsDirty: mockMarkAsDirty, discardSection: mockDiscardSection },
    } as ReturnType<typeof useStore>)

    await act(async () => {
      render(<KafkaTypeVerification onCompleteStep={mockOnCompleteStep} />)
    })

    expect(screen.getByText(/No topic data available. Please select a topic first./)).toBeInTheDocument()
  })

  it('shows "No event data available for topic" when topic has no selectedEvent.event', async () => {
    vi.mocked(useStore).mockReturnValue({
      topicsStore: {
        getTopic: () => ({ name: 'my-topic', selectedEvent: { event: null } }),
        updateTopic: mockUpdateTopic,
      },
      coreStore: { markAsDirty: mockMarkAsDirty, discardSection: mockDiscardSection },
    } as ReturnType<typeof useStore>)

    await act(async () => {
      render(<KafkaTypeVerification onCompleteStep={mockOnCompleteStep} />)
    })

    expect(
      screen.getByText(/No event data available for topic "my-topic". Please ensure the topic has events./),
    ).toBeInTheDocument()
  })

  it('renders main content and FieldTypesTable when topic and event are set', async () => {
    vi.mocked(useStore).mockReturnValue({
      topicsStore: {
        getTopic: () => ({
          name: 'my-topic',
          selectedEvent: { event: { id: 1, name: 'a' } },
        }),
        updateTopic: mockUpdateTopic,
      },
      coreStore: { markAsDirty: mockMarkAsDirty, discardSection: mockDiscardSection },
    } as ReturnType<typeof useStore>)

    await act(async () => {
      render(<KafkaTypeVerification onCompleteStep={mockOnCompleteStep} />)
    })

    expect(screen.getByTestId('field-types-table')).toBeInTheDocument()
    expect(screen.getByTestId('form-actions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm Types' })).toBeInTheDocument()
  })

  it('save (wizard): calls updateTopic with schema, onSectionConfigured, onCompleteStep', async () => {
    const topic = {
      name: 'my-topic',
      selectedEvent: { event: { id: 1, name: 'a' } },
    }
    vi.mocked(useStore).mockReturnValue({
      topicsStore: {
        getTopic: () => topic,
        updateTopic: mockUpdateTopic,
      },
      coreStore: { markAsDirty: mockMarkAsDirty, discardSection: mockDiscardSection },
    } as ReturnType<typeof useStore>)

    await act(async () => {
      render(<KafkaTypeVerification onCompleteStep={mockOnCompleteStep} />)
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-types-btn'))
    })

    expect(mockUpdateTopic).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'my-topic',
        schema: expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({ name: 'id', userType: 'int32' }),
            expect.objectContaining({ name: 'name', userType: 'string' }),
          ]),
        }),
      }),
    )
    expect(mockOnSectionConfigured).toHaveBeenCalledWith(StepKeys.KAFKA_TYPE_VERIFICATION)
    expect(mockOnCompleteStep).toHaveBeenCalledWith(StepKeys.KAFKA_TYPE_VERIFICATION)
  })

  it('save (standalone): calls markAsDirty, onCompleteStandaloneEditing', async () => {
    const topic = {
      name: 'my-topic',
      selectedEvent: { event: { id: 1 } },
    }
    vi.mocked(useStore).mockReturnValue({
      topicsStore: { getTopic: () => topic, updateTopic: mockUpdateTopic },
      coreStore: { markAsDirty: mockMarkAsDirty, discardSection: mockDiscardSection },
    } as ReturnType<typeof useStore>)

    await act(async () => {
      render(
        <KafkaTypeVerification
          onCompleteStep={mockOnCompleteStep}
          standalone
          toggleEditMode={vi.fn()}
          onCompleteStandaloneEditing={mockOnCompleteStandaloneEditing}
        />,
      )
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-types-btn'))
    })

    expect(mockUpdateTopic).toHaveBeenCalled()
    expect(mockOnSectionConfigured).toHaveBeenCalledWith(StepKeys.KAFKA_TYPE_VERIFICATION)
    expect(mockMarkAsDirty).toHaveBeenCalled()
    expect(mockOnCompleteStandaloneEditing).toHaveBeenCalled()
    expect(mockOnCompleteStep).not.toHaveBeenCalled()
  })

  it('discard: calls coreStore.discardSection with topics', async () => {
    vi.mocked(useStore).mockReturnValue({
      topicsStore: {
        getTopic: () => ({ name: 'my-topic', selectedEvent: { event: { id: 1 } } }),
        updateTopic: mockUpdateTopic,
      },
      coreStore: { markAsDirty: mockMarkAsDirty, discardSection: mockDiscardSection },
    } as ReturnType<typeof useStore>)

    await act(async () => {
      render(<KafkaTypeVerification onCompleteStep={mockOnCompleteStep} />)
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('discard-btn'))
    })

    expect(mockDiscardSection).toHaveBeenCalledWith('topics')
  })
})
