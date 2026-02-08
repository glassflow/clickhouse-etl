import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getSidebarItems,
  getSourceItems,
  getTransformationItems,
  getSinkItems,
} from './sidebarItemBuilders'
import { StepKeys } from '@/src/config/constants'

// Mock feature flags
vi.mock('@/src/config/feature-flags', () => ({
  isFiltersEnabled: vi.fn(() => true),
}))

import { isFiltersEnabled } from '@/src/config/feature-flags'

/**
 * Helper to create a minimal pipeline config for testing
 * Uses 'any' to avoid strict type requirements in tests
 */
function createPipeline(overrides: Record<string, any> = {}): any {
  return {
    pipeline_id: 'test-pipeline-id',
    name: 'Test Pipeline',
    status: 'stopped',
    source: {
      topics: [],
      ...overrides.source,
    },
    sink: {
      table: 'test_table',
      ...overrides.sink,
    },
    ...overrides,
  }
}

describe('sidebarItemBuilders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFiltersEnabled).mockReturnValue(true)
  })

  describe('getSourceItems', () => {
    it('should return Kafka connection for empty pipeline', () => {
      const pipeline = createPipeline()
      const items = getSourceItems(pipeline)

      expect(items).toContainEqual({
        key: 'kafka-connection',
        label: 'Kafka Connection',
        stepKey: StepKeys.KAFKA_CONNECTION,
      })
    })

    it('should return single topic items for single-topic pipeline', () => {
      const pipeline = createPipeline({
        source: {
          topics: [{ name: 'topic1', deduplication: { enabled: false } }],
        },
      })
      const items = getSourceItems(pipeline)

      expect(items).toContainEqual({
        key: 'topic',
        label: 'Topic',
        stepKey: StepKeys.TOPIC_SELECTION_1,
        topicIndex: 0,
      })
      expect(items).toContainEqual({
        key: 'type-verification',
        label: 'Verify Field Types',
        stepKey: StepKeys.KAFKA_TYPE_VERIFICATION,
        topicIndex: 0,
      })
    })

    it('should include deduplication item for single-topic with dedup enabled', () => {
      const pipeline = createPipeline({
        source: {
          topics: [{ name: 'topic1', deduplication: { enabled: true, id_field: 'id' } }],
        },
      })
      const items = getSourceItems(pipeline)

      expect(items).toContainEqual({
        key: 'deduplicate',
        label: 'Deduplicate',
        stepKey: StepKeys.DEDUPLICATION_CONFIGURATOR,
        topicIndex: 0,
      })
    })

    it('should return multi-topic items for multi-topic pipeline', () => {
      const pipeline = createPipeline({
        source: {
          topics: [
            { name: 'left-topic', deduplication: { enabled: false } },
            { name: 'right-topic', deduplication: { enabled: false } },
          ],
        },
      })
      const items = getSourceItems(pipeline)

      expect(items).toContainEqual({
        key: 'left-topic',
        label: 'Left Topic',
        stepKey: StepKeys.TOPIC_SELECTION_1,
        topicIndex: 0,
      })
      expect(items).toContainEqual({
        key: 'left-type-verification',
        label: 'Left Topic Types',
        stepKey: StepKeys.KAFKA_TYPE_VERIFICATION,
        topicIndex: 0,
      })
      expect(items).toContainEqual({
        key: 'right-topic',
        label: 'Right Topic',
        stepKey: StepKeys.TOPIC_SELECTION_2,
        topicIndex: 1,
      })
      expect(items).toContainEqual({
        key: 'right-type-verification',
        label: 'Right Topic Types',
        stepKey: StepKeys.KAFKA_TYPE_VERIFICATION,
        topicIndex: 1,
      })
    })

    it('should show combined topic+dedup label for multi-topic with dedup', () => {
      const pipeline = createPipeline({
        source: {
          topics: [
            { name: 'left-topic', deduplication: { enabled: true, id_field: 'id' } },
            { name: 'right-topic', deduplication: { enabled: true, id_field: 'id' } },
          ],
        },
      })
      const items = getSourceItems(pipeline)

      expect(items).toContainEqual({
        key: 'left-topic',
        label: 'Left Topic & Dedup',
        stepKey: StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
        topicIndex: 0,
      })
      expect(items).toContainEqual({
        key: 'right-topic',
        label: 'Right Topic & Dedup',
        stepKey: StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
        topicIndex: 1,
      })
    })
  })

  describe('getTransformationItems', () => {
    it('should include join for multi-topic pipeline with join enabled', () => {
      const pipeline = createPipeline({
        source: {
          topics: [{ name: 'left' }, { name: 'right' }],
        },
        join: { enabled: true, sources: [] },
      })
      const items = getTransformationItems(pipeline)

      expect(items).toContainEqual({
        key: 'join',
        label: 'Join Configuration',
        stepKey: StepKeys.JOIN_CONFIGURATOR,
      })
    })

    it('should not include join for single-topic pipeline', () => {
      const pipeline = createPipeline({
        source: {
          topics: [{ name: 'topic1' }],
        },
        join: { enabled: true, sources: [] },
      })
      const items = getTransformationItems(pipeline)

      expect(items.find((i) => i.key === 'join')).toBeUndefined()
    })

    it('should include filter when feature flag is enabled', () => {
      vi.mocked(isFiltersEnabled).mockReturnValue(true)
      const pipeline = createPipeline()
      const items = getTransformationItems(pipeline)

      expect(items).toContainEqual({
        key: 'filter',
        label: 'Filter',
        stepKey: StepKeys.FILTER_CONFIGURATOR,
      })
    })

    it('should not include filter when feature flag is disabled', () => {
      vi.mocked(isFiltersEnabled).mockReturnValue(false)
      const pipeline = createPipeline()
      const items = getTransformationItems(pipeline)

      expect(items.find((i) => i.key === 'filter')).toBeUndefined()
    })

    it('should include transformations when enabled with fields', () => {
      const pipeline = createPipeline({
        transformation: {
          enabled: true,
          fields: [{ name: 'field1', transform: 'passthrough' }],
        },
      })
      const items = getTransformationItems(pipeline)

      expect(items).toContainEqual({
        key: 'transformation',
        label: 'Transformations',
        stepKey: StepKeys.TRANSFORMATION_CONFIGURATOR,
      })
    })

    it('should include transformations from stateless_transformation format', () => {
      const pipeline = createPipeline({
        stateless_transformation: {
          enabled: true,
          config: {
            transform: [{ field: 'field1' }],
          },
        },
      })
      const items = getTransformationItems(pipeline)

      expect(items).toContainEqual({
        key: 'transformation',
        label: 'Transformations',
        stepKey: StepKeys.TRANSFORMATION_CONFIGURATOR,
      })
    })

    it('should not include transformations when disabled', () => {
      const pipeline = createPipeline({
        transformation: {
          enabled: false,
          fields: [{ name: 'field1' }],
        },
      })
      const items = getTransformationItems(pipeline)

      expect(items.find((i) => i.key === 'transformation')).toBeUndefined()
    })

    it('should not include transformations when no fields', () => {
      const pipeline = createPipeline({
        transformation: {
          enabled: true,
          fields: [],
        },
      })
      const items = getTransformationItems(pipeline)

      expect(items.find((i) => i.key === 'transformation')).toBeUndefined()
    })
  })

  describe('getSinkItems', () => {
    it('should return ClickHouse connection and destination items', () => {
      const items = getSinkItems()

      expect(items).toEqual([
        {
          key: 'clickhouse-connection',
          label: 'ClickHouse Connection',
          stepKey: StepKeys.CLICKHOUSE_CONNECTION,
        },
        {
          key: 'destination',
          label: 'Destination',
          stepKey: StepKeys.CLICKHOUSE_MAPPER,
        },
      ])
    })
  })

  describe('getSidebarItems', () => {
    it('should start with monitor item', () => {
      const pipeline = createPipeline()
      const items = getSidebarItems(pipeline)

      expect(items[0]).toEqual({ key: 'monitor', label: 'Monitor' })
    })

    it('should include all sections in correct order', () => {
      const pipeline = createPipeline({
        source: {
          topics: [{ name: 'topic1', deduplication: { enabled: true, id_field: 'id' } }],
        },
        transformation: {
          enabled: true,
          fields: [{ name: 'field1' }],
        },
      })
      const items = getSidebarItems(pipeline)

      const keys = items.map((i) => i.key)

      // Verify order: monitor -> source items -> transformation items -> sink items
      expect(keys.indexOf('monitor')).toBeLessThan(keys.indexOf('kafka-connection'))
      expect(keys.indexOf('kafka-connection')).toBeLessThan(keys.indexOf('topic'))
      expect(keys.indexOf('topic')).toBeLessThan(keys.indexOf('filter'))
      expect(keys.indexOf('transformation')).toBeLessThan(keys.indexOf('clickhouse-connection'))
      expect(keys.indexOf('clickhouse-connection')).toBeLessThan(keys.indexOf('destination'))
    })

    it('should handle complex multi-topic join+dedup pipeline', () => {
      const pipeline = createPipeline({
        source: {
          topics: [
            { name: 'left-topic', deduplication: { enabled: true, id_field: 'id' } },
            { name: 'right-topic', deduplication: { enabled: true, id_field: 'id' } },
          ],
        },
        join: { enabled: true, sources: [] },
        transformation: {
          enabled: true,
          fields: [{ name: 'field1' }],
        },
      })
      const items = getSidebarItems(pipeline)

      const keys = items.map((i) => i.key)

      expect(keys).toContain('monitor')
      expect(keys).toContain('kafka-connection')
      expect(keys).toContain('left-topic')
      expect(keys).toContain('left-type-verification')
      expect(keys).toContain('right-topic')
      expect(keys).toContain('right-type-verification')
      expect(keys).toContain('join')
      expect(keys).toContain('filter')
      expect(keys).toContain('transformation')
      expect(keys).toContain('clickhouse-connection')
      expect(keys).toContain('destination')
    })
  })
})
