import { describe, it, expect, beforeEach } from 'vitest'
import { create } from 'zustand'
import { createDomainSlice, DomainSlice } from './domain.store'
import type { PipelineDomain, SourceConfig, SinkConfig, ResourceConfig } from '@/src/types/pipeline-domain'
import type { SchemaField } from '@/src/types/schema'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const useTestStore = create<DomainSlice>()(createDomainSlice)

const sampleSchemaFields: SchemaField[] = [
  { name: 'id', type: 'string', nullable: false, source: 'topic' },
  { name: 'timestamp', type: 'timestamp', nullable: false, source: 'topic' },
  { name: 'value', type: 'number', nullable: true, source: 'topic' },
]

const sampleSource: SourceConfig = {
  type: 'kafka',
  id: 'orders',
  connectionConfig: { bootstrapServers: 'localhost:9092', authMethod: 'NO_AUTH' },
  schemaFields: sampleSchemaFields,
}

const sampleSink: SinkConfig = {
  type: 'clickhouse',
  connectionConfig: {
    host: 'localhost',
    httpPort: '8123',
    database: 'default',
    username: 'default',
    table: 'orders_sink',
    secure: false,
    skip_certificate_verification: false,
  },
  tableMapping: [
    { sourceField: 'id', targetColumn: 'id', columnType: 'String' },
    { sourceField: 'value', targetColumn: 'value', columnType: 'Float64' },
  ],
}

const sampleResources: ResourceConfig = {
  maxBatchSize: 500,
  maxDelayTime: '30s',
}

const sampleDomain: PipelineDomain = {
  id: 'test-pipeline-id',
  name: 'Test Pipeline',
  sources: [sampleSource],
  transforms: [],
  sink: sampleSink,
  resources: sampleResources,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('domain store', () => {
  beforeEach(() => {
    useTestStore.getState().domainStore.reset()
  })

  // ── 1. setDomain + getSchema ───────────────────────────────────────────────

  it('setDomain stores the domain and getSchema returns the source schema when no transforms are active', () => {
    const { domainStore } = useTestStore.getState()

    domainStore.setDomain(sampleDomain)

    expect(useTestStore.getState().domainStore.domain).toEqual(sampleDomain)

    const schema = useTestStore.getState().domainStore.getSchema()
    expect(schema).toHaveLength(sampleSchemaFields.length)
    expect(schema.map((f) => f.name)).toEqual(sampleSchemaFields.map((f) => f.name))
  })

  it('getSchema returns empty array when domain has no sources', () => {
    const { domainStore } = useTestStore.getState()

    domainStore.setDomain({ ...sampleDomain, sources: [] })

    const schema = useTestStore.getState().domainStore.getSchema()
    expect(schema).toHaveLength(0)
  })

  // ── 2. validate() — valid domain ──────────────────────────────────────────

  it('validate() returns valid:true for a complete domain', () => {
    const { domainStore } = useTestStore.getState()

    domainStore.setDomain(sampleDomain)

    const result = useTestStore.getState().domainStore.validate()
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  // ── 3. validate() — missing name ──────────────────────────────────────────

  it('validate() returns valid:false with errors when name is missing', () => {
    const { domainStore } = useTestStore.getState()

    domainStore.setDomain({ ...sampleDomain, name: '' })

    const result = useTestStore.getState().domainStore.validate()
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.toLowerCase().includes('name'))).toBe(true)
  })

  it('validate() returns valid:false when sources array is empty', () => {
    const { domainStore } = useTestStore.getState()

    domainStore.setDomain({ ...sampleDomain, name: 'My Pipeline', sources: [] })

    const result = useTestStore.getState().domainStore.validate()
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.toLowerCase().includes('source'))).toBe(true)
  })

  // ── 4. toWireFormat() — correct pipeline_id ───────────────────────────────

  it('toWireFormat() returns InternalPipelineConfig with correct pipeline_id', () => {
    const { domainStore } = useTestStore.getState()

    domainStore.setDomain(sampleDomain)

    const wire = useTestStore.getState().domainStore.toWireFormat()

    expect(wire.pipeline_id).toBe('test-pipeline-id')
    expect(wire.name).toBe('Test Pipeline')
  })

  it('toWireFormat() generates a UUID for pipeline_id when domain.id is undefined', () => {
    const { domainStore } = useTestStore.getState()

    domainStore.setDomain({ ...sampleDomain, id: undefined })

    const wire = useTestStore.getState().domainStore.toWireFormat()

    // UUID v4 pattern
    expect(wire.pipeline_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('toWireFormat() maps sink connection config to the wire format', () => {
    const { domainStore } = useTestStore.getState()

    domainStore.setDomain(sampleDomain)

    const wire = useTestStore.getState().domainStore.toWireFormat()

    expect(wire.sink.host).toBe('localhost')
    expect(wire.sink.table).toBe('orders_sink')
    expect(wire.sink.database).toBe('default')
    expect(wire.sink.max_batch_size).toBe(500)
    expect(wire.sink.max_delay_time).toBe('30s')
  })

  it('toWireFormat() maps table_mapping from sink.tableMapping', () => {
    const { domainStore } = useTestStore.getState()

    domainStore.setDomain(sampleDomain)

    const wire = useTestStore.getState().domainStore.toWireFormat()

    expect(wire.sink.table_mapping).toHaveLength(2)
    expect(wire.sink.table_mapping[0].field_name).toBe('id')
    expect(wire.sink.table_mapping[0].column_name).toBe('id')
    expect(wire.sink.table_mapping[1].field_name).toBe('value')
    expect(wire.sink.table_mapping[1].column_type).toBe('Float64')
  })

  // ── 5. isDirty tracking ────────────────────────────────────────────────────

  it('isDirty is set to true after setDomain', () => {
    const { domainStore } = useTestStore.getState()
    expect(domainStore.isDirty).toBe(false)

    domainStore.setDomain(sampleDomain)

    expect(useTestStore.getState().domainStore.isDirty).toBe(true)
  })

  it('markClean sets isDirty to false', () => {
    const { domainStore } = useTestStore.getState()
    domainStore.setDomain(sampleDomain)
    domainStore.markClean()

    expect(useTestStore.getState().domainStore.isDirty).toBe(false)
  })

  // ── 6. reset ──────────────────────────────────────────────────────────────

  it('reset restores domain to initialDomain and clears isDirty', () => {
    const { domainStore } = useTestStore.getState()
    domainStore.setDomain(sampleDomain)
    domainStore.reset()

    const afterReset = useTestStore.getState().domainStore
    expect(afterReset.domain.name).toBe('')
    expect(afterReset.domain.sources).toHaveLength(0)
    expect(afterReset.isDirty).toBe(false)
  })

  // ── 7. updateSources / updateSink / updateResources ───────────────────────

  it('updateSources replaces sources and marks dirty', () => {
    const { domainStore } = useTestStore.getState()
    domainStore.setDomain({ ...sampleDomain, name: 'pipeline' })
    domainStore.markClean()

    const newSource: SourceConfig = { ...sampleSource, id: 'new-topic' }
    useTestStore.getState().domainStore.updateSources([newSource])

    const updated = useTestStore.getState().domainStore
    expect(updated.domain.sources[0].id).toBe('new-topic')
    expect(updated.isDirty).toBe(true)
  })

  it('updateResources replaces resources', () => {
    const { domainStore } = useTestStore.getState()
    domainStore.setDomain(sampleDomain)

    useTestStore.getState().domainStore.updateResources({ maxBatchSize: 9999, maxDelayTime: '5m' })

    expect(useTestStore.getState().domainStore.domain.resources.maxBatchSize).toBe(9999)
    expect(useTestStore.getState().domainStore.domain.resources.maxDelayTime).toBe('5m')
  })
})
