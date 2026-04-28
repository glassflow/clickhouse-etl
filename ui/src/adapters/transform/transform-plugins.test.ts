import { describe, test, expect, vi } from 'vitest'
import type { SchemaField } from '@/src/types/schema'

// ---------------------------------------------------------------------------
// Mock zustand store to avoid jsdom / window dependencies in unit tests
// ---------------------------------------------------------------------------
vi.mock('@/src/store/index', () => ({
  useStore: {
    getState: () => ({
      deduplicationStore: { deduplicationConfigs: {} },
      filterStore: { filterConfig: { enabled: false } },
      joinStore: { enabled: false },
      transformationStore: { transformationConfig: { enabled: false, fields: [] } },
    }),
  },
}))

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------
import { getTransformPlugin, getAllTransformPlugins } from './index'
import type { DeduplicationConfig } from '@/src/store/deduplication.store'
import type { FilterPluginConfig } from './filter/plugin'
import type { TransformationConfig } from '@/src/store/transformation.store'

// ---------------------------------------------------------------------------
// Sample schema for schema passthrough tests
// ---------------------------------------------------------------------------
const sampleFields: SchemaField[] = [
  { name: 'id', type: 'string', nullable: false, source: 'topic' },
  { name: 'timestamp', type: 'timestamp', nullable: false, source: 'topic' },
  { name: 'amount', type: 'number', nullable: true, source: 'topic' },
]

// ---------------------------------------------------------------------------
// 1. Registry
// ---------------------------------------------------------------------------
describe('Registry', () => {
  test('getTransformPlugin("deduplication") returns a plugin', () => {
    const plugin = getTransformPlugin('deduplication')
    expect(plugin).toBeDefined()
    expect(plugin.type).toBe('deduplication')
  })

  test('getTransformPlugin("filter") returns a plugin', () => {
    const plugin = getTransformPlugin('filter')
    expect(plugin).toBeDefined()
    expect(plugin.type).toBe('filter')
  })

  test('getTransformPlugin("join") returns a plugin', () => {
    const plugin = getTransformPlugin('join')
    expect(plugin).toBeDefined()
    expect(plugin.type).toBe('join')
  })

  test('getTransformPlugin("stateless") returns a plugin', () => {
    const plugin = getTransformPlugin('stateless')
    expect(plugin).toBeDefined()
    expect(plugin.type).toBe('stateless')
  })

  test('getAllTransformPlugins returns all four plugins', () => {
    const plugins = getAllTransformPlugins()
    expect(plugins.length).toBe(4)
    const types = plugins.map((p) => p.type).sort()
    expect(types).toEqual(['deduplication', 'filter', 'join', 'stateless'])
  })

  test('getTransformPlugin throws for unregistered type', () => {
    expect(() => getTransformPlugin('unknown' as never)).toThrow(
      'No transform plugin registered for type: unknown',
    )
  })
})

// ---------------------------------------------------------------------------
// 2. Filter plugin validation
// ---------------------------------------------------------------------------
describe('Filter plugin — validate', () => {
  test('returns { valid: false } for empty expression when enabled', () => {
    const plugin = getTransformPlugin('filter')
    const result = plugin.validate({ enabled: true, expression: '' } as FilterPluginConfig)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  test('returns { valid: true } for non-empty expression', () => {
    const plugin = getTransformPlugin('filter')
    const result = plugin.validate({ enabled: true, expression: 'x > 0' } as FilterPluginConfig)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('returns { valid: true } when filter is disabled regardless of expression', () => {
    const plugin = getTransformPlugin('filter')
    const result = plugin.validate({ enabled: false, expression: '' } as FilterPluginConfig)
    expect(result.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. Dedup plugin validation
// ---------------------------------------------------------------------------
describe('Deduplication plugin — validate', () => {
  test('returns { valid: false } for empty key when enabled', () => {
    const plugin = getTransformPlugin('deduplication')
    const config: DeduplicationConfig = {
      enabled: true,
      key: '',
      keyType: 'string',
      window: 24,
      unit: 'hours',
    }
    const result = plugin.validate(config)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  test('returns { valid: true } for valid config', () => {
    const plugin = getTransformPlugin('deduplication')
    const config: DeduplicationConfig = {
      enabled: true,
      key: 'order_id',
      keyType: 'string',
      window: 24,
      unit: 'hours',
    }
    const result = plugin.validate(config)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('returns { valid: true } when disabled (no key required)', () => {
    const plugin = getTransformPlugin('deduplication')
    const config: DeduplicationConfig = {
      enabled: false,
      key: '',
      keyType: '',
      window: 0,
      unit: 'minutes',
    }
    const result = plugin.validate(config)
    expect(result.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. Schema passthrough — filter and dedup
// ---------------------------------------------------------------------------
describe('Schema passthrough', () => {
  test('filter getOutputSchema returns input unchanged', () => {
    const plugin = getTransformPlugin('filter')
    const output = plugin.getOutputSchema(sampleFields, {
      enabled: true,
      expression: 'amount > 100',
    } as FilterPluginConfig)
    expect(output).toEqual(sampleFields)
  })

  test('dedup getOutputSchema returns input unchanged', () => {
    const plugin = getTransformPlugin('deduplication')
    const config: DeduplicationConfig = {
      enabled: true,
      key: 'id',
      keyType: 'string',
      window: 1,
      unit: 'hours',
    }
    const output = plugin.getOutputSchema(sampleFields, config)
    expect(output).toEqual(sampleFields)
  })

  test('filter getInputSchema returns upstream unchanged', () => {
    const plugin = getTransformPlugin('filter')
    const input = plugin.getInputSchema(sampleFields)
    expect(input).toEqual(sampleFields)
  })

  test('dedup getInputSchema returns upstream unchanged', () => {
    const plugin = getTransformPlugin('deduplication')
    const input = plugin.getInputSchema(sampleFields)
    expect(input).toEqual(sampleFields)
  })
})

// ---------------------------------------------------------------------------
// 5. Stateless plugin validation
// ---------------------------------------------------------------------------
describe('Stateless plugin — validate', () => {
  test('returns { valid: false } when enabled with no fields', () => {
    const plugin = getTransformPlugin('stateless')
    const config: TransformationConfig = { enabled: true, fields: [] }
    const result = plugin.validate(config)
    expect(result.valid).toBe(false)
  })

  test('returns { valid: true } when disabled', () => {
    const plugin = getTransformPlugin('stateless')
    const config: TransformationConfig = { enabled: false, fields: [] }
    const result = plugin.validate(config)
    expect(result.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 6. Wire format round-trip — filter
// ---------------------------------------------------------------------------
describe('Filter plugin — wire format', () => {
  test('toWireFormat wraps expression in !(…)', () => {
    const plugin = getTransformPlugin('filter')
    const wire = plugin.toWireFormat({ enabled: true, expression: 'x > 0' } as FilterPluginConfig)
    expect((wire as unknown as { expression: string }).expression).toBe('!(x > 0)')
  })

  test('fromWireFormat strips !(…) wrapper', () => {
    const plugin = getTransformPlugin('filter')
    const config = plugin.fromWireFormat({
      type: 'filter',
      enabled: true,
      expression: '!(x > 0)',
    }) as FilterPluginConfig
    expect(config.expression).toBe('x > 0')
    expect(config.enabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 7. Wire format round-trip — deduplication
// ---------------------------------------------------------------------------
describe('Deduplication plugin — wire format', () => {
  test('toWireFormat maps key → id_field and window+unit → time_window', () => {
    const plugin = getTransformPlugin('deduplication')
    const config: DeduplicationConfig = {
      enabled: true,
      key: 'order_id',
      keyType: 'string',
      window: 24,
      unit: 'hours',
    }
    const wire = plugin.toWireFormat(config)
    expect((wire as unknown as { id_field: string }).id_field).toBe('order_id')
    expect((wire as unknown as { time_window: string }).time_window).toBe('24h')
  })

  test('fromWireFormat maps id_field → key and time_window → window+unit', () => {
    const plugin = getTransformPlugin('deduplication')
    const config = plugin.fromWireFormat({
      type: 'deduplication',
      enabled: true,
      id_field: 'user_id',
      id_field_type: 'string',
      time_window: '30m',
    }) as DeduplicationConfig
    expect(config.key).toBe('user_id')
    expect(config.window).toBe(30)
    expect(config.unit).toBe('minutes')
  })
})
