import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useActiveViewState } from './useActiveViewState'
import { createMockPipeline } from '../__tests__/test-helpers'
import { StepKeys } from '@/src/config/constants'

vi.mock('@/src/modules/pipelines/[id]/PipelineDetailsSidebar', () => ({
  getSidebarItems: (pipeline: { source?: { topics?: unknown[] }; join?: { enabled?: boolean } }) => {
    const topics = pipeline?.source?.topics ?? []
    const items = [
      { key: 'monitor', label: 'Monitor' },
      { key: 'kafka-connection', label: 'Kafka Connection', stepKey: StepKeys.KAFKA_CONNECTION },
    ]
    if (topics.length > 0) {
      items.push(
        { key: 'topic', label: 'Topic', stepKey: StepKeys.TOPIC_SELECTION_1, topicIndex: 0 },
        { key: 'type-verification', label: 'Verify Field Types', stepKey: StepKeys.KAFKA_TYPE_VERIFICATION, topicIndex: 0 }
      )
    }
    if (pipeline?.join?.enabled) {
      items.push({ key: 'join', label: 'Join', stepKey: StepKeys.JOIN_CONFIGURATOR })
    }
    items.push(
      { key: 'clickhouse-connection', label: 'ClickHouse Connection', stepKey: StepKeys.CLICKHOUSE_CONNECTION },
      { key: 'destination', label: 'Destination', stepKey: StepKeys.CLICKHOUSE_MAPPER }
    )
    return items
  },
}))

describe('useActiveViewState', () => {
  const pipeline = createMockPipeline({
    source: {
      ...createMockPipeline().source,
      topics: [
        {
          name: 'test-topic',
          id: 't1',
          schema: { type: 'json', fields: [] },
          consumer_group_initial_offset: 'earliest',
          deduplication: { enabled: false, id_field: '', id_field_type: 'string', time_window: '1' },
        },
      ],
    },
    join: { type: 'inner', enabled: true, sources: [] },
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns default state (monitor, no step)', () => {
    const { result } = renderHook(() => useActiveViewState())

    expect(result.current.activeSection).toBe('monitor')
    expect(result.current.activeStep).toBe(null)
    expect(result.current.activeTopicIndex).toBe(0)
  })

  it('setViewBySection updates section and step when section has stepKey', () => {
    const { result } = renderHook(() => useActiveViewState())

    act(() => {
      result.current.setViewBySection('kafka-connection', pipeline)
    })

    expect(result.current.activeSection).toBe('kafka-connection')
    expect(result.current.activeStep).toBe(StepKeys.KAFKA_CONNECTION)
  })

  it('setViewBySection(monitor) clears active step', () => {
    const { result } = renderHook(() => useActiveViewState())

    act(() => {
      result.current.setViewBySection('kafka-connection', pipeline)
    })
    expect(result.current.activeStep).toBe(StepKeys.KAFKA_CONNECTION)

    act(() => {
      result.current.setViewBySection('monitor', pipeline)
    })

    expect(result.current.activeSection).toBe('monitor')
    expect(result.current.activeStep).toBe(null)
  })

  it('setViewByStep updates step and section', () => {
    const { result } = renderHook(() => useActiveViewState())

    act(() => {
      result.current.setViewByStep(StepKeys.KAFKA_CONNECTION, pipeline)
    })

    expect(result.current.activeStep).toBe(StepKeys.KAFKA_CONNECTION)
    expect(result.current.activeSection).toBe('kafka-connection')
  })

  it('setViewByStep with topicIndex updates activeTopicIndex', () => {
    const { result } = renderHook(() => useActiveViewState())

    act(() => {
      result.current.setViewByStep(StepKeys.KAFKA_TYPE_VERIFICATION, pipeline, 0)
    })

    expect(result.current.activeTopicIndex).toBe(0)
  })

  it('closeStep resets to monitor view', () => {
    const { result } = renderHook(() => useActiveViewState())

    act(() => {
      result.current.setViewBySection('kafka-connection', pipeline)
    })

    act(() => {
      result.current.closeStep()
    })

    expect(result.current.activeStep).toBe(null)
    expect(result.current.activeSection).toBe('monitor')
  })

  it('accepts initial state', () => {
    const { result } = renderHook(() =>
      useActiveViewState({ activeSection: 'kafka-connection', activeStep: StepKeys.KAFKA_CONNECTION })
    )

    expect(result.current.activeSection).toBe('kafka-connection')
    expect(result.current.activeStep).toBe(StepKeys.KAFKA_CONNECTION)
  })
})
