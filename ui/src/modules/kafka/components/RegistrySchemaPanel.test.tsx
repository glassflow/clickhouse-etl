import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RegistrySchemaPanel } from './RegistrySchemaPanel'

vi.mock('@/src/store', () => ({ useStore: vi.fn() }))
vi.mock('@/src/modules/kafka/hooks/useSchemaRegistryState', () => ({ useSchemaRegistryState: vi.fn() }))

import { useStore } from '@/src/store'
import { useSchemaRegistryState } from '@/src/modules/kafka/hooks/useSchemaRegistryState'

const mockApplyAutoResolved = vi.fn()
const mockDismissAutoResolved = vi.fn()
const mockClearAppliedSchema = vi.fn()

function makeHookState(overrides: Record<string, unknown> = {}) {
  return {
    subjects: [],
    selectedSubject: '',
    versions: [],
    selectedVersion: 'latest',
    isLoadingSubjects: false,
    isLoadingVersions: false,
    isLoadingSchema: false,
    schemaError: undefined,
    schemaLoaded: false,
    schemaFieldCount: 0,
    autoResolved: null,
    autoResolveDismissed: false,
    autoResolutionAttempted: false,
    isResolvingFromEvent: false,
    fetchSubjects: vi.fn(),
    selectSubject: vi.fn(),
    fetchVersionsForSubject: vi.fn(),
    selectVersion: vi.fn(),
    resolveFromEvent: vi.fn(),
    applyAutoResolved: mockApplyAutoResolved,
    dismissAutoResolved: mockDismissAutoResolved,
    clearAppliedSchema: mockClearAppliedSchema,
    ...overrides,
  }
}

function makeStore(topicOverride: any = null) {
  return { topicsStore: { getTopic: vi.fn().mockReturnValue(topicOverride) } }
}

describe('RegistrySchemaPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSchemaRegistryState).mockReturnValue(makeHookState() as any)
    vi.mocked(useStore).mockReturnValue(makeStore() as any)
  })

  it('renders nothing when topicName is empty', () => {
    const { container } = render(<RegistrySchemaPanel topicName="" topicIndex={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows subject dropdown placeholder when subjects are loading', () => {
    vi.mocked(useSchemaRegistryState).mockReturnValue(makeHookState({ isLoadingSubjects: true }) as any)
    render(<RegistrySchemaPanel topicName="orders" topicIndex={0} />)
    expect(screen.getByText(/Loading subjects/)).toBeInTheDocument()
  })

  it('shows auto-detection banner when autoResolved is set and not dismissed', () => {
    vi.mocked(useSchemaRegistryState).mockReturnValue(
      makeHookState({
        autoResolved: { schemaId: 5, subject: 'orders-value', version: 3, fields: [{ name: 'id', type: 'string' }] },
        autoResolveDismissed: false,
      }) as any,
    )
    render(<RegistrySchemaPanel topicName="orders" topicIndex={0} />)
    expect(screen.getByText('Schema detected in event')).toBeInTheDocument()
    expect(screen.getByText('Use this schema')).toBeInTheDocument()
    expect(screen.getByText('Ignore')).toBeInTheDocument()
  })

  it('hides auto-detection banner when autoResolveDismissed is true', () => {
    vi.mocked(useSchemaRegistryState).mockReturnValue(
      makeHookState({
        autoResolved: { schemaId: 5, subject: 'orders-value', version: 3, fields: [{ name: 'id', type: 'string' }] },
        autoResolveDismissed: true,
      }) as any,
    )
    render(<RegistrySchemaPanel topicName="orders" topicIndex={0} />)
    expect(screen.queryByText('Schema detected in event')).not.toBeInTheDocument()
  })

  it('calls applyAutoResolved when "Use this schema" is clicked', () => {
    vi.mocked(useSchemaRegistryState).mockReturnValue(
      makeHookState({
        autoResolved: { schemaId: 5, subject: 'orders-value', version: 3, fields: [{ name: 'id', type: 'string' }] },
      }) as any,
    )
    render(<RegistrySchemaPanel topicName="orders" topicIndex={0} />)
    fireEvent.click(screen.getByText('Use this schema'))
    expect(mockApplyAutoResolved).toHaveBeenCalledOnce()
  })

  it('calls dismissAutoResolved when "Ignore" is clicked', () => {
    vi.mocked(useSchemaRegistryState).mockReturnValue(
      makeHookState({
        autoResolved: { schemaId: 5, subject: 'orders-value', version: 3, fields: [{ name: 'id', type: 'string' }] },
      }) as any,
    )
    render(<RegistrySchemaPanel topicName="orders" topicIndex={0} />)
    fireEvent.click(screen.getByText('Ignore'))
    expect(mockDismissAutoResolved).toHaveBeenCalledOnce()
  })

  it('shows schema applied state when topic has external schema', () => {
    vi.mocked(useStore).mockReturnValue(
      makeStore({
        schemaSource: 'external',
        schemaRegistrySubject: 'orders-value',
        schemaRegistryVersion: '3',
        schema: { fields: [{ name: 'id', type: 'string', userType: 'string' }] },
      }) as any,
    )
    render(<RegistrySchemaPanel topicName="orders" topicIndex={0} />)
    expect(screen.getByText(/Schema applied/)).toBeInTheDocument()
    expect(screen.getByText('Continue with event-based detection')).toBeInTheDocument()
  })

  it('calls clearAppliedSchema when "Continue with event-based detection" is clicked', () => {
    vi.mocked(useStore).mockReturnValue(
      makeStore({
        schemaSource: 'external',
        schemaRegistrySubject: 'orders-value',
        schemaRegistryVersion: '3',
        schema: { fields: [{ name: 'id', type: 'string', userType: 'string' }] },
      }) as any,
    )
    render(<RegistrySchemaPanel topicName="orders" topicIndex={0} />)
    fireEvent.click(screen.getByText('Continue with event-based detection'))
    expect(mockClearAppliedSchema).toHaveBeenCalledOnce()
  })
})
