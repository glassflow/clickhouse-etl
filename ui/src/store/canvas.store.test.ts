import { describe, it, expect } from 'vitest'
import { create } from 'zustand'
import { createCanvasSlice, type CanvasSlice } from './canvas.store'
import { pipelineConfigToCanvas } from '@/src/modules/canvas/serializer'
import type { InternalPipelineConfig } from '@/src/types/pipeline'

function makeStore() {
  return create<CanvasSlice>()((set, get, api) => ({
    ...createCanvasSlice(set, get, api),
  }))
}

const minimalConfig = (): InternalPipelineConfig => ({
  pipeline_id: '',
  name: '',
  source: {
    type: 'kafka',
    connection_params: { brokers: ['b:9092'], protocol: 'PLAINTEXT', mechanism: 'PLAIN' },
    topics: [
      {
        name: 'events',
        id: 'events',
        schema: { type: 'json', fields: [] },
        consumer_group_initial_offset: 'latest',
        deduplication: { enabled: false, id_field: '', id_field_type: 'string', time_window: '24h' },
      },
    ],
  },
  join: { enabled: false },
  sink: {
    type: 'clickhouse',
    host: 'localhost',
    httpPort: '8123',
    database: 'db',
    table: 'tbl',
    secure: false,
    table_mapping: [],
    max_batch_size: 1000,
    max_delay_time: '1s',
    skip_certificate_verification: false,
  },
})

describe('canvasStore — initFromConfig', () => {
  it('populates nodes from hydration', () => {
    const store = makeStore()
    const hydration = pipelineConfigToCanvas(minimalConfig())
    store.getState().canvasStore.initFromConfig(hydration)
    expect(store.getState().canvasStore.nodes.map((n) => n.id)).toEqual([
      'source', 'dedup', 'filter', 'transform', 'sink',
    ])
  })

  it('populates nodeConfigs from hydration', () => {
    const store = makeStore()
    const hydration = pipelineConfigToCanvas(minimalConfig())
    store.getState().canvasStore.initFromConfig(hydration)
    expect(store.getState().canvasStore.nodeConfigs['source']?.topicName).toBe('events')
    expect(store.getState().canvasStore.nodeConfigs['sink']?.host).toBe('localhost')
  })

  it('sets isDirty to false', () => {
    const store = makeStore()
    store.getState().canvasStore.initFromConfig(pipelineConfigToCanvas(minimalConfig()))
    expect(store.getState().canvasStore.isDirty).toBe(false)
  })

  it('sets sourceType from hydration', () => {
    const store = makeStore()
    store.getState().canvasStore.initFromConfig(pipelineConfigToCanvas(minimalConfig()))
    expect(store.getState().canvasStore.sourceType).toBe('kafka')
  })
})
