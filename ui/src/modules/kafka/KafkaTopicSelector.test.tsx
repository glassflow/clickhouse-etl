import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { KafkaTopicSelector } from './KafkaTopicSelector'
import { StepKeys } from '@/src/config/constants'

const mockOnCompleteStep = vi.fn()
const mockSubmit = vi.fn()
const mockSelectTopic = vi.fn()
const mockApplyPartitionCountToReplica = vi.fn()
const mockMarkSectionAsValid = vi.fn()
const mockMarkAsDirty = vi.fn()
const mockOnCompleteStandaloneEditing = vi.fn()
const mockDiscardSections = vi.fn()

vi.mock('@/src/store', () => ({
  useStore: vi.fn(),
}))

vi.mock('@/src/store/state-machine/validation-engine', () => ({
  useValidationEngine: () => ({
    markSectionAsValid: mockMarkSectionAsValid,
  }),
}))

vi.mock('@/src/modules/kafka/useGetIndex', () => ({
  __esModule: true,
  default: (currentStep: string) => {
    if (
      currentStep === StepKeys.TOPIC_SELECTION_1 ||
      currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1
    )
      return () => 0
    if (
      currentStep === StepKeys.TOPIC_SELECTION_2 ||
      currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2
    )
      return () => 1
    return () => 0
  },
}))

vi.mock('@/src/modules/kafka/hooks/useKafkaTopicSelectorState', () => ({
  useKafkaTopicSelectorState: () => ({
    topicName: 'my-topic',
    offset: 'latest' as const,
    event: { id: 1 },
    isLoading: false,
    isEmptyTopic: false,
    error: null,
    deduplicationConfig: {},
    deduplicationConfigured: true,
    canContinue: true,
    manualEvent: '',
    isManualEventValid: false,
    replicas: 2,
    partitionCount: 2,
    selectTopic: mockSelectTopic,
    selectOffset: vi.fn(),
    selectReplicaCount: vi.fn(),
    updatePartitionCount: vi.fn(),
    configureDeduplication: vi.fn(),
    handleManualEventChange: vi.fn(),
    submit: mockSubmit,
    currentOffset: 0,
    earliestOffset: 0,
    latestOffset: 100,
    isAtLatest: true,
    isAtEarliest: false,
    fetchNewestEvent: vi.fn(),
    fetchOldestEvent: vi.fn(),
    fetchNextEvent: vi.fn(),
    fetchPreviousEvent: vi.fn(),
    refreshEvent: vi.fn(),
  }),
}))

vi.mock('@/src/modules/kafka/hooks/useTopicSelectorTopics', () => ({
  useTopicSelectorTopics: () => ({
    availableTopics: ['my-topic', 'other'],
    fetchTopics: vi.fn(),
    getPartitionCount: () => 2,
  }),
}))

vi.mock('@/src/modules/kafka/components/TopicSelectWithEventPreview', () => ({
  TopicSelectWithEventPreview: (props: { onTopicChange?: (name: string, ev: unknown) => void }) => (
    <div data-testid="topic-select-preview">
      <button
        type="button"
        data-testid="change-topic-btn"
        onClick={() => props.onTopicChange?.('new-topic', {})}
      >
        Change topic
      </button>
    </div>
  ),
}))

vi.mock('@/src/modules/kafka/components/TopicChangeConfirmationModal', () => ({
  __esModule: true,
  default: ({
    visible,
    onOk,
    onCancel,
  }: {
    visible: boolean
    onOk: () => void
    onCancel: () => void
  }) =>
    visible ? (
      <div data-testid="topic-change-modal">
        <button type="button" data-testid="modal-confirm" onClick={onOk}>
          Confirm
        </button>
        <button type="button" data-testid="modal-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}))

vi.mock('@/src/components/shared/FormActions', () => ({
  __esModule: true,
  default: ({
    onSubmit,
    onDiscard,
    disabled,
    readOnly,
  }: {
    onSubmit: () => void
    onDiscard: () => void
    disabled: boolean
    readOnly?: boolean
  }) => (
    <div data-testid="form-actions">
      <button type="button" data-testid="submit-btn" onClick={onSubmit} disabled={disabled}>
        Continue
      </button>
      <button type="button" data-testid="discard-btn" onClick={onDiscard} disabled={!!readOnly}>
        Discard
      </button>
    </div>
  ),
}))

vi.mock('@/src/modules/deduplication/components/SelectDeduplicateKeys', () => ({
  SelectDeduplicateKeys: () => null,
}))

import { useStore } from '@/src/store'

describe('KafkaTopicSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useStore).mockReturnValue({
      topicsStore: { topics: { 0: undefined } },
      coreStore: {
        topicCount: 1,
        markAsDirty: mockMarkAsDirty,
        discardSections: mockDiscardSections,
      },
    } as ReturnType<typeof useStore>)
  })

  it('renders and with topic/event canContinue true shows Continue enabled', async () => {
    await act(async () => {
      render(
        <KafkaTopicSelector
          currentStep={StepKeys.TOPIC_SELECTION_1}
          onCompleteStep={mockOnCompleteStep}
          validate={() => true}
        />,
      )
    })
    expect(screen.getByTestId('topic-select-preview')).toBeInTheDocument()
    expect(screen.getByTestId('form-actions')).toBeInTheDocument()
    const submitBtn = screen.getByTestId('submit-btn')
    expect(submitBtn).not.toBeDisabled()
  })

  it('submit (wizard): calls submit() and onCompleteStep with stepKey', async () => {
    await act(async () => {
      render(
        <KafkaTopicSelector
          currentStep={StepKeys.TOPIC_SELECTION_1}
          onCompleteStep={mockOnCompleteStep}
          validate={() => true}
        />,
      )
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'))
    })
    expect(mockSubmit).toHaveBeenCalled()
    expect(mockOnCompleteStep).toHaveBeenCalledWith(StepKeys.TOPIC_SELECTION_1)
  })

  it('submit (standalone): calls markSectionAsValid, markAsDirty, onCompleteStandaloneEditing', async () => {
    await act(async () => {
      render(
        <KafkaTopicSelector
          currentStep={StepKeys.TOPIC_SELECTION_1}
          onCompleteStep={mockOnCompleteStep}
          validate={() => true}
          standalone
          toggleEditMode={vi.fn()}
          onCompleteStandaloneEditing={mockOnCompleteStandaloneEditing}
        />,
      )
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'))
    })
    expect(mockSubmit).toHaveBeenCalled()
    expect(mockMarkSectionAsValid).toHaveBeenCalledWith(StepKeys.TOPIC_SELECTION_1)
    expect(mockMarkAsDirty).toHaveBeenCalled()
    expect(mockOnCompleteStandaloneEditing).toHaveBeenCalled()
  })

  it('discard: calls coreStore.discardSections with topics for non-dedup step', async () => {
    await act(async () => {
      render(
        <KafkaTopicSelector
          currentStep={StepKeys.TOPIC_SELECTION_1}
          onCompleteStep={mockOnCompleteStep}
          validate={() => true}
        />,
      )
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('discard-btn'))
    })
    expect(mockDiscardSections).toHaveBeenCalledWith(['topics'])
  })

  it('discard: calls discardSections with topics and deduplication for deduplication step', async () => {
    await act(async () => {
      render(
        <KafkaTopicSelector
          currentStep={StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1}
          onCompleteStep={mockOnCompleteStep}
          validate={() => true}
        />,
      )
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('discard-btn'))
    })
    expect(mockDiscardSections).toHaveBeenCalledWith(['topics', 'deduplication'])
  })

  it('topic change in edit mode: shows modal and on confirm calls selectTopic', async () => {
    vi.mocked(useStore).mockReturnValue({
      topicsStore: { topics: { 0: { name: 'old-topic' } } },
      coreStore: {
        topicCount: 1,
        markAsDirty: mockMarkAsDirty,
        discardSections: mockDiscardSections,
      },
    } as ReturnType<typeof useStore>)

    await act(async () => {
      render(
        <KafkaTopicSelector
          currentStep={StepKeys.TOPIC_SELECTION_1}
          onCompleteStep={mockOnCompleteStep}
          validate={() => true}
          standalone
          readOnly={false}
          toggleEditMode={vi.fn()}
        />,
      )
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('change-topic-btn'))
    })
    expect(screen.getByTestId('topic-change-modal')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByTestId('modal-confirm'))
    })
    expect(mockSelectTopic).toHaveBeenCalledWith('new-topic')
  })
})
