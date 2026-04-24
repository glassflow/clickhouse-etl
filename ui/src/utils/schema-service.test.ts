import { describe, test, expect } from 'vitest'
import { getEffectiveSchema } from './schema-service'
import type { RootStoreState } from '@/src/store/index'
import { SourceType } from '@/src/config/source-types'
import { OTLP_LOGS_FIELDS } from '@/src/modules/otlp/constants'

// ---------------------------------------------------------------------------
// Minimal stub helpers
// ---------------------------------------------------------------------------

/** Create a minimal RootStoreState with just the slices getEffectiveSchema reads */
function makeState(overrides: Partial<RootStoreState>): RootStoreState {
  const noop = () => {}
  const noopAsync = async () => {}

  const base = {
    coreStore: {
      sourceType: SourceType.KAFKA,
      pipelineId: '',
      pipelineName: '',
      topicCount: 1,
      operationsSelected: { ingest: true, deduplication: false },
      pipelineVersion: undefined,
      outboundEventPreview: null,
      analyticsConsent: false,
      consentAnswered: false,
      isDirty: false,
      apiConfig: {},
      mode: 'create',
      baseConfig: undefined,
      lastSavedConfig: undefined,
      saveHistory: [],
      setApiConfig: noop,
      setTopicCount: noop,
      setSourceType: noop,
      setOperationsSelected: noop,
      getComputedOperation: () => 'ingest-only',
      setOutboundEventPreview: noop,
      setAnalyticsConsent: noop,
      setConsentAnswered: noop,
      markAsDirty: noop,
      markAsClean: noop,
      setPipelineId: noop,
      setPipelineName: noop,
      resetPipelineState: noop,
      setPipelineVersion: noop,
      setMode: noop,
      setBaseConfig: noop,
      hydrateFromConfig: noopAsync,
      resetToInitial: noop,
      discardChanges: noop,
      enterCreateMode: noop,
      enterEditMode: noop,
      enterViewMode: noopAsync,
      isDirtyComparedToBase: () => false,
      setLastSavedConfig: noop,
      addToSaveHistory: noop,
      getLastSavedConfig: () => undefined,
      getSaveHistory: () => [],
      clearSaveHistory: noop,
      discardToLastSaved: noopAsync,
      hydrateSection: noopAsync,
      discardSection: noopAsync,
      discardSections: noop,
    },
    topicsStore: {
      availableTopics: [],
      topicCount: 1,
      topics: {},
      validation: { status: 'initial' },
      setAvailableTopics: noop,
      setTopicCount: noop,
      updateTopic: noop,
      getTopic: () => undefined,
      getEvent: () => undefined,
      invalidateTopicDependentState: noop,
      resetTopicsStore: noop,
      markAsValid: noop,
      markAsInvalidated: noop,
      markAsNotConfigured: noop,
      resetValidation: noop,
    },
    transformationStore: {
      transformationConfig: { enabled: false, fields: [] },
      backendValidation: { status: 'idle' },
      validation: { status: 'initial' },
      addField: noop,
      addComputedField: noop,
      addPassthroughField: noop,
      updateField: noop,
      removeField: noop,
      reorderFields: noop,
      setEnabled: noop,
      setBackendValidation: noop,
      skipTransformation: noop,
      resetTransformationStore: noop,
      getIntermediarySchema: () => [],
      hasFields: () => false,
      getFieldCount: () => 0,
      markAsValid: noop,
      markAsInvalidated: noop,
      markAsNotConfigured: noop,
      resetValidation: noop,
    },
    otlpStore: {
      signalType: null,
      sourceId: '',
      deduplication: { enabled: false, key: '', time_window: '5m' },
      schemaFields: [],
      validation: { status: 'initial' },
      setSignalType: noop,
      setSourceId: noop,
      setDeduplication: noop,
      skipDeduplication: noop,
      resetOtlpStore: noop,
      markAsValid: noop,
      markAsInvalidated: noop,
      markAsNotConfigured: noop,
      resetValidation: noop,
    },
    joinStore: {
      enabled: false,
      type: 'temporal',
      streams: [],
      validation: { status: 'initial' },
      setEnabled: noop,
      setType: noop,
      setStreams: noop,
      getIsJoinDirty: () => false,
      resetJoinStore: noop,
      markAsValid: noop,
      markAsInvalidated: noop,
      markAsNotConfigured: noop,
      resetValidation: noop,
    },
    // unused slices
    kafkaStore: {},
    clickhouseConnectionStore: {},
    clickhouseDestinationStore: {},
    stepsStore: {},
    deduplicationStore: {},
    filterStore: {},
    notificationsStore: {},
    resourcesStore: {},
    resetAllPipelineState: noop,
    resetForNewPipeline: noop,
    resetFormValidationStates: noop,
    clearAllUserData: noop,
  }

  return { ...base, ...overrides } as unknown as RootStoreState
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getEffectiveSchema — single topic (Kafka)', () => {
  test('returns fields from topic schema', () => {
    const state = makeState({
      topicsStore: {
        topics: {
          0: {
            name: 'my-topic',
            index: 0,
            events: [],
            selectedEvent: {} as never,
            initialOffset: 'latest',
            schema: {
              fields: [
                { name: 'id', type: 'string' },
                { name: 'count', type: 'int' },
              ],
            },
          },
        },
      } as unknown as RootStoreState['topicsStore'],
    })

    const schema = getEffectiveSchema(state)
    expect(schema).toHaveLength(2)
    expect(schema[0]).toMatchObject({ name: 'id', type: 'string', source: 'topic' })
    expect(schema[1]).toMatchObject({ name: 'count', type: 'number', source: 'topic' })
  })

  test('returns empty array when topic has no schema', () => {
    const state = makeState({})
    expect(getEffectiveSchema(state)).toEqual([])
  })

  test('excludes removed fields', () => {
    const state = makeState({
      topicsStore: {
        topics: {
          0: {
            name: 'my-topic',
            index: 0,
            events: [],
            selectedEvent: {} as never,
            initialOffset: 'latest',
            schema: {
              fields: [
                { name: 'active', type: 'string' },
                { name: 'removed', type: 'string', isRemoved: true },
              ],
            },
          },
        },
      } as unknown as RootStoreState['topicsStore'],
    })
    const schema = getEffectiveSchema(state)
    expect(schema).toHaveLength(1)
    expect(schema[0].name).toBe('active')
  })
})

describe('getEffectiveSchema — transformation supplement', () => {
  test('returns transform output fields when transformation is active', () => {
    const state = makeState({
      transformationStore: {
        transformationConfig: {
          enabled: true,
          fields: [
            {
              id: '1',
              type: 'passthrough',
              outputFieldName: 'user_id',
              outputFieldType: 'string',
              sourceField: 'id',
              sourceFieldType: 'string',
            },
            {
              id: '2',
              type: 'computed',
              outputFieldName: 'total',
              outputFieldType: 'number',
              functionName: 'sum',
              functionArgs: [{ type: 'field', fieldName: 'amount', fieldType: 'number' }],
            },
          ],
        },
      } as unknown as RootStoreState['transformationStore'],
    })

    const schema = getEffectiveSchema(state)
    // Both fields are "complete" — passthrough needs sourceField, computed needs functionName+args
    expect(schema.length).toBeGreaterThanOrEqual(1)
    const names = schema.map((f) => f.name)
    expect(names).toContain('user_id')
  })
})

describe('getEffectiveSchema — join mode', () => {
  test('merges fields from both topics without duplicates', () => {
    const state = makeState({
      joinStore: {
        enabled: true,
        type: 'temporal',
        streams: [
          { streamId: 's1', topicName: 't1', joinKey: 'id', joinTimeWindowValue: 1, joinTimeWindowUnit: 'm', orientation: 'left' },
          { streamId: 's2', topicName: 't2', joinKey: 'id', joinTimeWindowValue: 1, joinTimeWindowUnit: 'm', orientation: 'right' },
        ],
        validation: { status: 'initial' },
        setEnabled: () => {},
        setType: () => {},
        setStreams: () => {},
        getIsJoinDirty: () => false,
        resetJoinStore: () => {},
        markAsValid: () => {},
        markAsInvalidated: () => {},
        markAsNotConfigured: () => {},
        resetValidation: () => {},
      } as unknown as RootStoreState['joinStore'],
      topicsStore: {
        topics: {
          0: {
            name: 't1',
            index: 0,
            events: [],
            selectedEvent: {} as never,
            initialOffset: 'latest',
            schema: { fields: [{ name: 'id', type: 'string' }, { name: 'value', type: 'float' }] },
          },
          1: {
            name: 't2',
            index: 1,
            events: [],
            selectedEvent: {} as never,
            initialOffset: 'latest',
            schema: { fields: [{ name: 'id', type: 'string' }, { name: 'label', type: 'string' }] },
          },
        },
      } as unknown as RootStoreState['topicsStore'],
    })

    const schema = getEffectiveSchema(state)
    const names = schema.map((f) => f.name)
    // 'id' should appear only once (deduplicated)
    expect(names.filter((n) => n === 'id')).toHaveLength(1)
    expect(names).toContain('value')
    expect(names).toContain('label')
  })
})

describe('getEffectiveSchema — OTLP source', () => {
  test('returns static OTLP schema fields', () => {
    const state = makeState({
      coreStore: {
        sourceType: SourceType.OTLP_LOGS,
      } as unknown as RootStoreState['coreStore'],
      otlpStore: {
        signalType: SourceType.OTLP_LOGS,
        schemaFields: OTLP_LOGS_FIELDS,
      } as unknown as RootStoreState['otlpStore'],
    })

    const schema = getEffectiveSchema(state)
    expect(schema.length).toBeGreaterThan(0)
    const names = schema.map((f) => f.name)
    expect(names).toContain('timestamp')
    expect(names).toContain('body')
    expect(names).toContain('severity_text')
    schema.forEach((f) => {
      expect(f.source).toBe('topic')
    })
  })

  test('falls back to getOtlpFieldsForSignalType when schemaFields is empty', () => {
    const state = makeState({
      coreStore: {
        sourceType: SourceType.OTLP_LOGS,
      } as unknown as RootStoreState['coreStore'],
      otlpStore: {
        signalType: SourceType.OTLP_LOGS,
        schemaFields: [],
      } as unknown as RootStoreState['otlpStore'],
    })

    const schema = getEffectiveSchema(state)
    expect(schema.length).toBeGreaterThan(0)
  })
})
