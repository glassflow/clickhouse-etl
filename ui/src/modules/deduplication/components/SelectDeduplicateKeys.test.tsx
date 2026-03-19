import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import SelectDeduplicateKeys from './SelectDeduplicateKeys'
import { TIME_WINDOW_UNIT_OPTIONS } from '@/src/config/constants'

const mockOnChange = vi.fn()
const mockGetTopic = vi.fn()
const mockGetDeduplication = vi.fn()

vi.mock('@/src/store', () => ({
  useStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      topicsStore: { getTopic: mockGetTopic },
      deduplicationStore: { getDeduplication: mockGetDeduplication },
    }
    if (typeof selector === 'function') {
      return selector(state)
    }
    return state
  }),
}))

vi.mock('@/src/components/common/SearchableSelect', () => ({
  SearchableSelect: ({
    availableOptions,
    selectedOption,
    onSelect,
  }: {
    availableOptions: string[]
    selectedOption: string
    onSelect: (key: string | null) => void
  }) => (
    <div data-testid="searchable-select">
      <span data-testid="available-options">{availableOptions.join(',')}</span>
      <span data-testid="selected-option">{selectedOption}</span>
      <button type="button" data-testid="select-id" onClick={() => onSelect('id')}>
        Select id
      </button>
      <button type="button" data-testid="select-name" onClick={() => onSelect('name')}>
        Select name
      </button>
      <button type="button" data-testid="clear" onClick={() => onSelect(null)}>
        Clear
      </button>
    </div>
  ),
}))

vi.mock('./TimeWindowConfigurator', () => ({
  TimeWindowConfigurator: ({
    window: w,
    setWindow,
    setWindowUnit,
  }: {
    window: number
    setWindow: (v: number) => void
    setWindowUnit: (v: string) => void
  }) => (
    <div data-testid="time-window-configurator">
      <span data-testid="window-value">{w}</span>
      <button type="button" data-testid="set-window-2" onClick={() => setWindow(2)}>
        Set window 2
      </button>
      <button type="button" data-testid="set-unit-days" onClick={() => setWindowUnit('days')}>
        Set unit days
      </button>
    </div>
  ),
}))

describe('SelectDeduplicateKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTopic.mockReturnValue({ name: 'my-topic' })
    mockGetDeduplication.mockReturnValue(undefined)
  })

  it('shows loading then no keys message when eventData is empty and no schemaFields', async () => {
    render(
      <SelectDeduplicateKeys
        index={0}
        onChange={mockOnChange}
        eventData={{}}
      />,
    )
    await act(async () => { })
    expect(screen.getByText(/No keys found in event data|Please select a topic with valid event data/)).toBeInTheDocument()
  })

  it('derives keys from eventData when no schemaFields', async () => {
    render(
      <SelectDeduplicateKeys
        index={0}
        onChange={mockOnChange}
        eventData={{ id: 1, name: 'test' }}
      />,
    )
    await act(async () => { })
    expect(screen.getByTestId('available-options')).toHaveTextContent('id,name')
  })

  it('derives keys from schemaFields when provided', async () => {
    const schemaFields = [
      { name: 'userId', inferredType: 'string', userType: 'string', isManuallyAdded: false, isRemoved: false },
      { name: 'eventId', inferredType: 'string', userType: 'string', isManuallyAdded: false, isRemoved: false },
    ]
    render(
      <SelectDeduplicateKeys
        index={0}
        onChange={mockOnChange}
        eventData={{}}
        schemaFields={schemaFields}
      />,
    )
    await act(async () => { })
    expect(screen.getByTestId('available-options')).toHaveTextContent('userId,eventId')
  })

  it('initializes selection and window from deduplicationConfig in store', async () => {
    mockGetDeduplication.mockReturnValue({
      key: 'id',
      keyType: 'string',
      window: 3,
      unit: 'days',
    })
    render(
      <SelectDeduplicateKeys
        index={0}
        onChange={mockOnChange}
        eventData={{ id: 1, name: 'a' }}
      />,
    )
    await act(async () => { })
    expect(screen.getByTestId('selected-option')).toHaveTextContent('id')
    expect(screen.getByTestId('window-value')).toHaveTextContent('3')
  })

  it('calls onChange with keyConfig and windowConfig when key is selected', async () => {
    render(
      <SelectDeduplicateKeys
        index={0}
        onChange={mockOnChange}
        eventData={{ id: 1, name: 'a' }}
      />,
    )
    await act(async () => { })
    const selectIdBtn = screen.getByTestId('select-id')
    await act(async () => {
      selectIdBtn.click()
    })
    expect(mockOnChange).toHaveBeenCalledWith(
      { key: 'id', keyType: 'string' },
      { window: 1, unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value },
    )
  })

  it('calls onChange with updated window when TimeWindowConfigurator setWindow is used', async () => {
    render(
      <SelectDeduplicateKeys
        index={0}
        onChange={mockOnChange}
        eventData={{ id: 1, name: 'a' }}
      />,
    )
    await act(async () => { })
    const setWindow2Btn = screen.getByTestId('set-window-2')
    await act(async () => {
      setWindow2Btn.click()
    })
    expect(mockOnChange).toHaveBeenCalledWith(
      { key: '', keyType: 'string' },
      { window: 2, unit: TIME_WINDOW_UNIT_OPTIONS.HOURS.value },
    )
  })

  it('shows message when eventData is falsy (no topic/event loaded)', async () => {
    render(
      <SelectDeduplicateKeys
        index={0}
        onChange={mockOnChange}
        eventData={null as unknown as Record<string, any>}
      />,
    )
    await act(async () => { })
    expect(screen.getByText(/Select a topic and wait for event data to load/)).toBeInTheDocument()
  })
})
