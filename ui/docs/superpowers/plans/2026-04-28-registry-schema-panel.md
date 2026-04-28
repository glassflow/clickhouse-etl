# Registry Schema Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `SchemaSourceSelector` with `RegistrySchemaPanel` — a unified component that auto-detects schemas from Confluent wire format (with user prompt) and always shows a subject/version dropdown for manual selection, gated on `kafkaStore.schemaRegistry?.enabled`.

**Architecture:** Extend `useSchemaRegistryState` with topic-triggered subject fetch, auto-load-on-version-select, `dismissAutoResolved`, and `clearAppliedSchema`. Replace `SchemaSourceSelector.tsx` with `RegistrySchemaPanel.tsx` that renders four states (no topic → null, loading/idle, auto-detect prompt, schema applied). Downstream consumers (`KafkaTypeVerification`, `useClickhouseMapperEventFields`, V3 adapter) are untouched.

**Tech Stack:** Next.js App Router, React 18, Zustand, Vitest, React Testing Library, TypeScript strict

---

## File Map

| Action | File |
|---|---|
| Modify | `src/modules/kafka/hooks/useSchemaRegistryState.ts` |
| Create | `src/modules/kafka/hooks/useSchemaRegistryState.test.ts` |
| Create | `src/modules/kafka/components/RegistrySchemaPanel.tsx` |
| Create | `src/modules/kafka/components/RegistrySchemaPanel.test.tsx` |
| Modify | `src/modules/kafka/KafkaTopicSelector.tsx` |
| Delete | `src/modules/kafka/components/SchemaSourceSelector.tsx` |

---

### Task 1: Extend `useSchemaRegistryState` hook

**Files:**
- Modify: `src/modules/kafka/hooks/useSchemaRegistryState.ts`
- Create: `src/modules/kafka/hooks/useSchemaRegistryState.test.ts`

- [ ] **Step 1.1: Write failing tests**

Create `src/modules/kafka/hooks/useSchemaRegistryState.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useSchemaRegistryState } from './useSchemaRegistryState'

vi.mock('@/src/store', () => ({ useStore: vi.fn() }))
import { useStore } from '@/src/store'

const mockUpdateTopic = vi.fn()
const mockGetTopic = vi.fn()

function makeStore(topicOverride: any = null) {
  return {
    kafkaStore: {
      schemaRegistry: {
        url: 'http://registry.example.com',
        authMethod: 'none',
        enabled: true,
        apiKey: '',
        apiSecret: '',
        username: '',
        password: '',
      },
    },
    topicsStore: {
      getTopic: mockGetTopic.mockReturnValue(topicOverride),
      updateTopic: mockUpdateTopic,
    },
  }
}

describe('useSchemaRegistryState', () => {
  beforeEach(() => {
    vi.mocked(useStore).mockReturnValue(makeStore() as any)
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, subjects: ['orders-value'] }),
    })
  })

  afterEach(() => { vi.clearAllMocks() })

  it('does not fetch subjects on mount when topicName is empty', () => {
    renderHook(() => useSchemaRegistryState('', 0))
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('fetches subjects when topicName is non-empty on mount', async () => {
    await act(async () => { renderHook(() => useSchemaRegistryState('orders', 0)) })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/ui-api/kafka/schema-registry/subjects',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('fetches subjects when topicName changes from empty to non-empty', async () => {
    let topicName = ''
    const { rerender } = renderHook(() => useSchemaRegistryState(topicName, 0))
    expect(globalThis.fetch).not.toHaveBeenCalled()
    topicName = 'orders'
    await act(async () => { rerender() })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/ui-api/kafka/schema-registry/subjects',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('auto-loads schema when selectVersion is called with subject already set', async () => {
    vi.mocked(globalThis.fetch as any)
      .mockResolvedValueOnce({ json: async () => ({ success: true, subjects: ['orders-value'] }) })
      .mockResolvedValueOnce({ json: async () => ({ success: true, versions: [{ version: 3, label: 'v3' }] }) })
      .mockResolvedValueOnce({ json: async () => ({ success: true, fields: [{ name: 'id', type: 'string' }], version: 3 }) })
    vi.mocked(useStore).mockReturnValue(
      makeStore({ index: 0, name: 'orders', schemaSource: 'internal' }) as any,
    )
    const { result } = renderHook(() => useSchemaRegistryState('orders', 0))
    await act(async () => { await result.current.selectSubject('orders-value') })
    await act(async () => { result.current.selectVersion('3') })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/ui-api/kafka/schema-registry/schema',
      expect.objectContaining({ body: expect.stringContaining('"version":"3"') }),
    )
    expect(mockUpdateTopic).toHaveBeenCalledWith(
      expect.objectContaining({ schemaSource: 'external', schemaRegistrySubject: 'orders-value', schemaRegistryVersion: '3' }),
    )
  })

  it('clearAppliedSchema resets topic to internal and clears fields', () => {
    vi.mocked(useStore).mockReturnValue(
      makeStore({
        index: 0, name: 'orders', schemaSource: 'external',
        schemaRegistrySubject: 'orders-value', schemaRegistryVersion: '3',
        schema: { fields: [{ name: 'id', type: 'string', userType: 'string' }] },
      }) as any,
    )
    const { result } = renderHook(() => useSchemaRegistryState('orders', 0))
    act(() => { result.current.clearAppliedSchema() })
    expect(mockUpdateTopic).toHaveBeenCalledWith(
      expect.objectContaining({ schemaSource: 'internal', schemaRegistrySubject: undefined, schema: { fields: [] } }),
    )
  })

  it('dismissAutoResolved sets autoResolveDismissed true without writing to store', async () => {
    vi.mocked(globalThis.fetch as any).mockResolvedValue({
      json: async () => ({ success: true, schemaId: 5, subject: 'orders-value', version: 3, fields: [{ name: 'id', type: 'string' }] }),
    })
    const { result } = renderHook(() => useSchemaRegistryState('orders', 0))
    await act(async () => { await result.current.resolveFromEvent('AAAAA=') })
    expect(result.current.autoResolved).not.toBeNull()
    act(() => { result.current.dismissAutoResolved() })
    expect(result.current.autoResolveDismissed).toBe(true)
    expect(mockUpdateTopic).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 1.2: Run to confirm failures**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm vitest run src/modules/kafka/hooks/useSchemaRegistryState.test.ts --reporter verbose
```

Expected: 5 failing tests — `clearAppliedSchema`, `dismissAutoResolved`, `autoResolveDismissed` don't exist; topic-triggered fetch and auto-load aren't wired up.

- [ ] **Step 1.3: Replace `useSchemaRegistryState.ts` with the updated implementation**

```ts
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useStore } from '@/src/store'
import { isRegistrySchema } from '@/src/modules/kafka/utils/schemaSource'

export interface AutoResolved {
  schemaId: number
  subject?: string
  version?: number
  fields: Array<{ name: string; type: string }>
}

export interface SchemaRegistryStateHook {
  subjects: string[]
  selectedSubject: string
  versions: Array<{ version: number | string; label: string }>
  selectedVersion: string
  isLoadingSubjects: boolean
  isLoadingVersions: boolean
  isLoadingSchema: boolean
  schemaError: string | undefined
  schemaLoaded: boolean
  schemaFieldCount: number
  autoResolved: AutoResolved | null
  autoResolveDismissed: boolean
  autoResolutionAttempted: boolean
  isResolvingFromEvent: boolean
  fetchSubjects: () => Promise<void>
  selectSubject: (subject: string) => Promise<void>
  fetchVersionsForSubject: (subject: string) => Promise<void>
  selectVersion: (version: string) => void
  resolveFromEvent: (rawBase64: string) => Promise<void>
  applyAutoResolved: () => void
  dismissAutoResolved: () => void
  clearAppliedSchema: () => void
}

export function useSchemaRegistryState(topicName: string, topicIndex: number): SchemaRegistryStateHook {
  const { kafkaStore, topicsStore } = useStore()
  const { schemaRegistry } = kafkaStore

  const initialTopic = topicsStore.getTopic(topicIndex)
  const initialSubject = initialTopic?.schemaRegistrySubject ?? ''
  const initialVersion = initialTopic?.schemaRegistryVersion ?? 'latest'
  const initialFieldCount = initialTopic?.schema?.fields?.length ?? 0
  const initialSchemaLoaded = isRegistrySchema(initialTopic?.schemaSource) && initialFieldCount > 0

  const [subjects, setSubjects] = useState<string[]>(initialSubject ? [initialSubject] : [])
  const [selectedSubject, setSelectedSubject] = useState(initialSubject)
  const [versions, setVersions] = useState<Array<{ version: number | string; label: string }>>([])
  const [selectedVersion, setSelectedVersion] = useState(initialVersion)
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false)
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [isLoadingSchema, setIsLoadingSchema] = useState(false)
  const [schemaError, setSchemaError] = useState<string | undefined>(undefined)
  const [schemaLoaded, setSchemaLoaded] = useState(initialSchemaLoaded)
  const [schemaFieldCount, setSchemaFieldCount] = useState(initialFieldCount)
  const [autoResolved, setAutoResolved] = useState<AutoResolved | null>(null)
  const [autoResolveDismissed, setAutoResolveDismissed] = useState(false)
  const [autoResolutionAttempted, setAutoResolutionAttempted] = useState(false)
  const [isResolvingFromEvent, setIsResolvingFromEvent] = useState(false)

  const authBody = {
    url: schemaRegistry?.url,
    authMethod: schemaRegistry?.authMethod,
    apiKey: schemaRegistry?.apiKey,
    apiSecret: schemaRegistry?.apiSecret,
    username: schemaRegistry?.username,
    password: schemaRegistry?.password,
  }

  const fetchSubjects = useCallback(async () => {
    if (!schemaRegistry?.url) return
    setIsLoadingSubjects(true)
    setSchemaError(undefined)
    try {
      const response = await fetch('/ui-api/kafka/schema-registry/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authBody, topicName }),
      })
      const data = await response.json()
      if (data.success) {
        setSubjects(data.subjects || [])
      } else {
        setSchemaError(data.error || 'Failed to load subjects')
      }
    } catch {
      setSchemaError('Could not reach Schema Registry')
    } finally {
      setIsLoadingSubjects(false)
    }
  }, [schemaRegistry, topicName]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchVersionsForSubject = useCallback(
    async (subject: string) => {
      if (!schemaRegistry?.url || !subject) return
      setIsLoadingVersions(true)
      try {
        const response = await fetch('/ui-api/kafka/schema-registry/versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...authBody, subject }),
        })
        const data = await response.json()
        if (data.success) setVersions(data.versions || [])
      } catch {
        // Non-fatal on restore
      } finally {
        setIsLoadingVersions(false)
      }
    },
    [schemaRegistry], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Fetch subjects (and restore versions) whenever a topic is selected
  useEffect(() => {
    if (!topicName || !schemaRegistry?.url) return
    fetchSubjects()
    if (selectedSubject) fetchVersionsForSubject(selectedSubject)
  }, [topicName]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectSubject = useCallback(
    async (subject: string) => {
      setSelectedSubject(subject)
      setVersions([])
      setSelectedVersion('latest')
      setSchemaLoaded(false)
      setSchemaError(undefined)
      if (!schemaRegistry?.url || !subject) return
      setIsLoadingVersions(true)
      try {
        const response = await fetch('/ui-api/kafka/schema-registry/versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...authBody, subject }),
        })
        const data = await response.json()
        if (data.success) {
          setVersions(data.versions || [])
        } else {
          setSchemaError(data.error || 'Failed to load versions')
        }
      } catch {
        setSchemaError('Could not reach Schema Registry')
      } finally {
        setIsLoadingVersions(false)
      }
    },
    [schemaRegistry], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Extracted so selectVersion can call it with the new version before state settles
  const loadSchemaForSubjectVersion = useCallback(
    async (subject: string, version: string) => {
      if (!schemaRegistry?.url || !subject) return
      setIsLoadingSchema(true)
      setSchemaError(undefined)
      setSchemaLoaded(false)
      try {
        const response = await fetch('/ui-api/kafka/schema-registry/schema', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...authBody, subject, version }),
        })
        const data = await response.json()
        if (data.success && data.fields) {
          const topic = topicsStore.getTopic(topicIndex)
          if (topic) {
            const resolvedVersion = data.version !== undefined ? String(data.version) : version
            topicsStore.updateTopic({
              ...topic,
              schemaSource: 'external',
              schemaRegistrySubject: subject,
              schemaRegistryVersion: resolvedVersion,
              schema: {
                fields: data.fields.map((f: { name: string; type: string }) => ({
                  name: f.name,
                  type: f.type,
                  userType: f.type,
                })),
              },
            })
          }
          setSchemaFieldCount(data.fields.length)
          setSchemaLoaded(true)
        } else {
          setSchemaError(data.error || 'Failed to load schema')
        }
      } catch {
        setSchemaError('Could not reach Schema Registry')
      } finally {
        setIsLoadingSchema(false)
      }
    },
    [schemaRegistry, topicIndex, topicsStore], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const selectVersion = useCallback(
    (version: string) => {
      setSelectedVersion(version)
      setSchemaLoaded(false)
      if (selectedSubject) loadSchemaForSubjectVersion(selectedSubject, version)
    },
    [selectedSubject, loadSchemaForSubjectVersion],
  )

  const resolveFromEvent = useCallback(
    async (rawBase64: string) => {
      if (!schemaRegistry?.url) return
      setAutoResolveDismissed(false)
      setIsResolvingFromEvent(true)
      try {
        const response = await fetch('/ui-api/kafka/schema-registry/resolve-from-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...authBody, rawBase64 }),
        })
        const data = await response.json()
        if (data.success && data.fields?.length > 0) {
          setAutoResolved({ schemaId: data.schemaId, subject: data.subject, version: data.version, fields: data.fields })
        } else {
          setAutoResolved(null)
        }
      } catch {
        setAutoResolved(null)
      } finally {
        setIsResolvingFromEvent(false)
        setAutoResolutionAttempted(true)
      }
    },
    [schemaRegistry], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const applyAutoResolved = useCallback(() => {
    if (!autoResolved) return
    const topic = topicsStore.getTopic(topicIndex)
    if (!topic) return
    topicsStore.updateTopic({
      ...topic,
      schemaSource: 'registry_resolved_from_event',
      schemaRegistrySubject: autoResolved.subject,
      schemaRegistryVersion: autoResolved.version !== undefined ? String(autoResolved.version) : undefined,
      schema: {
        fields: autoResolved.fields.map((f) => ({ name: f.name, type: f.type, userType: f.type })),
      },
    })
    setSchemaFieldCount(autoResolved.fields.length)
    setSchemaLoaded(true)
  }, [autoResolved, topicIndex, topicsStore])

  const dismissAutoResolved = useCallback(() => {
    setAutoResolveDismissed(true)
  }, [])

  const clearAppliedSchema = useCallback(() => {
    const topic = topicsStore.getTopic(topicIndex)
    if (!topic) return
    topicsStore.updateTopic({
      ...topic,
      schemaSource: 'internal',
      schemaRegistrySubject: undefined,
      schemaRegistryVersion: undefined,
      schema: { fields: [] },
    })
    setSchemaLoaded(false)
    setSchemaFieldCount(0)
    setSelectedSubject('')
    setSelectedVersion('latest')
    setVersions([])
    setSchemaError(undefined)
  }, [topicIndex, topicsStore])

  return {
    subjects,
    selectedSubject,
    versions,
    selectedVersion,
    isLoadingSubjects,
    isLoadingVersions,
    isLoadingSchema,
    schemaError,
    schemaLoaded,
    schemaFieldCount,
    autoResolved,
    autoResolveDismissed,
    autoResolutionAttempted,
    isResolvingFromEvent,
    fetchSubjects,
    selectSubject,
    fetchVersionsForSubject,
    selectVersion,
    resolveFromEvent,
    applyAutoResolved,
    dismissAutoResolved,
    clearAppliedSchema,
  }
}
```

- [ ] **Step 1.4: Run tests — confirm all pass**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm vitest run src/modules/kafka/hooks/useSchemaRegistryState.test.ts --reporter verbose
```

Expected: 5 passing tests.

- [ ] **Step 1.5: Commit**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && git add src/modules/kafka/hooks/useSchemaRegistryState.ts src/modules/kafka/hooks/useSchemaRegistryState.test.ts && git commit -m "feat(schema): topic-triggered fetch, auto-load on version, dismissAutoResolved, clearAppliedSchema"
```

---

### Task 2: Create `RegistrySchemaPanel` component

**Files:**
- Create: `src/modules/kafka/components/RegistrySchemaPanel.tsx`
- Create: `src/modules/kafka/components/RegistrySchemaPanel.test.tsx`

- [ ] **Step 2.1: Write failing tests**

Create `src/modules/kafka/components/RegistrySchemaPanel.test.tsx`:

```tsx
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
```

- [ ] **Step 2.2: Run to confirm failures**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm vitest run src/modules/kafka/components/RegistrySchemaPanel.test.tsx --reporter verbose
```

Expected: All 8 tests fail — component doesn't exist yet.

- [ ] **Step 2.3: Create `RegistrySchemaPanel.tsx`**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/src/store'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/src/components/ui/select'
import { useSchemaRegistryState } from '@/src/modules/kafka/hooks/useSchemaRegistryState'
import { isRegistrySchema } from '@/src/modules/kafka/utils/schemaSource'

interface RegistrySchemaPanelProps {
  topicName: string
  topicIndex: number
  readOnly?: boolean
  liveEvent?: unknown
}

export function RegistrySchemaPanel({ topicName, topicIndex, readOnly, liveEvent }: RegistrySchemaPanelProps) {
  const { topicsStore } = useStore()
  const topic = topicsStore.getTopic(topicIndex)

  const {
    subjects,
    selectedSubject,
    versions,
    selectedVersion,
    isLoadingSubjects,
    isLoadingVersions,
    isLoadingSchema,
    schemaError,
    autoResolved,
    autoResolveDismissed,
    isResolvingFromEvent,
    selectSubject,
    selectVersion,
    resolveFromEvent,
    applyAutoResolved,
    dismissAutoResolved,
    clearAppliedSchema,
  } = useSchemaRegistryState(topicName, topicIndex)

  // All hooks before conditional returns
  const lastAttemptedRawBase64 = useRef<string | null>(null)
  const rawBase64 =
    (liveEvent as any)?._metadata?.rawBase64 ?? topic?.selectedEvent?.event?._metadata?.rawBase64

  useEffect(() => {
    if (!rawBase64 || rawBase64 === lastAttemptedRawBase64.current) return
    lastAttemptedRawBase64.current = rawBase64
    resolveFromEvent(rawBase64)
  }, [rawBase64]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!topicName) return null

  const schemaIsApplied = isRegistrySchema(topic?.schemaSource) && (topic?.schema?.fields?.length ?? 0) > 0
  const showAutoResolvedBanner = !!autoResolved && !autoResolveDismissed && !isResolvingFromEvent

  // State 4: schema applied
  if (schemaIsApplied) {
    return (
      <div className="space-y-2 pt-2">
        <p className="text-sm text-content-success">
          ✓ Schema applied — {topic?.schema?.fields?.length} field
          {topic?.schema?.fields?.length !== 1 ? 's' : ''} from {topic?.schemaRegistrySubject} v.
          {topic?.schemaRegistryVersion}
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={clearAppliedSchema}
            className="text-sm text-content-faded hover:underline"
          >
            Continue with event-based detection
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      {/* Auto-detection prompt banner */}
      {showAutoResolvedBanner && (
        <div className="rounded-md border border-border bg-background-neutral-faded px-4 py-3 text-sm space-y-1">
          <div className="font-medium text-content">Schema detected in event</div>
          <div className="text-content-faded">
            {autoResolved!.subject && `${autoResolved!.subject} · `}
            {autoResolved!.version !== undefined && `Version ${autoResolved!.version} · `}
            {autoResolved!.fields.length} field{autoResolved!.fields.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={applyAutoResolved}
              disabled={readOnly}
              className="text-sm font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Use this schema
            </button>
            <button
              type="button"
              onClick={dismissAutoResolved}
              disabled={readOnly}
              className="text-sm text-content-faded hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Ignore
            </button>
          </div>
        </div>
      )}

      {/* Subject/version selection — always visible when topic is set */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-content">Schema from Registry</p>

        <div className="space-y-1">
          <label className="text-xs font-medium text-content-faded">Subject</label>
          <Select value={selectedSubject} onValueChange={selectSubject} disabled={readOnly || isLoadingSubjects}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={isLoadingSubjects ? 'Loading subjects…' : 'Select subject'} />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedSubject && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-content-faded">Version</label>
            <Select
              value={selectedVersion}
              onValueChange={selectVersion}
              disabled={readOnly || isLoadingVersions || isLoadingSchema}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    isLoadingVersions ? 'Loading versions…' : isLoadingSchema ? 'Loading schema…' : 'Select version'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">latest</SelectItem>
                {versions.map((v) => (
                  <SelectItem key={v.version} value={String(v.version)}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoadingSchema && (
          <p className="text-sm text-content-faded">Loading schema…</p>
        )}

        {schemaError && (
          <p className="text-sm text-destructive">{schemaError}</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2.4: Run tests — confirm all pass**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm vitest run src/modules/kafka/components/RegistrySchemaPanel.test.tsx --reporter verbose
```

Expected: 8 passing tests.

- [ ] **Step 2.5: Commit**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && git add src/modules/kafka/components/RegistrySchemaPanel.tsx src/modules/kafka/components/RegistrySchemaPanel.test.tsx && git commit -m "feat(schema): add RegistrySchemaPanel component"
```

---

### Task 3: Wire into `KafkaTopicSelector`, remove `SchemaSourceSelector`

**Files:**
- Modify: `src/modules/kafka/KafkaTopicSelector.tsx` (line 16, lines 248–255)
- Delete: `src/modules/kafka/components/SchemaSourceSelector.tsx`

- [ ] **Step 3.1: Update import in `KafkaTopicSelector.tsx`**

Replace line 16:
```tsx
import { SchemaSourceSelector } from '@/src/modules/kafka/components/SchemaSourceSelector'
```
with:
```tsx
import { RegistrySchemaPanel } from '@/src/modules/kafka/components/RegistrySchemaPanel'
```

- [ ] **Step 3.2: Update `renderSchemaSourceSection` in `KafkaTopicSelector.tsx`**

Replace (lines 248–255):
```tsx
  const renderSchemaSourceSection = () => {
    if (!kafkaStore.schemaRegistry?.enabled) return null

    return (
      <div className="mt-4">
        <SchemaSourceSelector topicName={topicName} topicIndex={index} readOnly={readOnly} liveEvent={event} />
      </div>
    )
  }
```
with:
```tsx
  const renderSchemaSourceSection = () => {
    if (!kafkaStore.schemaRegistry?.enabled) return null

    return (
      <div className="mt-4">
        <RegistrySchemaPanel topicName={topicName} topicIndex={index} readOnly={readOnly} liveEvent={event} />
      </div>
    )
  }
```

- [ ] **Step 3.3: Delete `SchemaSourceSelector.tsx`**

```bash
rm /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui/src/modules/kafka/components/SchemaSourceSelector.tsx
```

- [ ] **Step 3.4: Type check**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm tsc --noEmit 2>&1 | grep -i "schemaSourceSelector\|RegistrySchemaPanel\|SchemaRegistryStateHook"
```

Expected: No output (no errors related to schema panel changes).

- [ ] **Step 3.5: Run all Kafka module tests**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && pnpm vitest run src/modules/kafka --reporter verbose
```

Expected: All tests pass.

- [ ] **Step 3.6: Commit**

```bash
cd /Users/vladimir.cutkovic/Documents/code/glassflow/clickhouse-etl/ui && git add src/modules/kafka/KafkaTopicSelector.tsx && git rm src/modules/kafka/components/SchemaSourceSelector.tsx && git commit -m "feat(schema): replace SchemaSourceSelector with RegistrySchemaPanel in topic selector"
```
