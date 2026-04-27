import { describe, it, expect, vi } from 'vitest'
import { OtlpSourceAdapter } from './adapter'
import type { AdapterDispatch, SourceAdapterStoreState } from '@/src/types/adapters'
import { SourceType } from '@/src/config/source-types'

describe('OtlpSourceAdapter', () => {
  describe('variants', () => {
    it('otlp.logs adapter has type "otlp.logs"', () => {
      expect(new OtlpSourceAdapter(SourceType.OTLP_LOGS).type).toBe('otlp.logs')
    })

    it('otlp.traces adapter has type "otlp.traces"', () => {
      expect(new OtlpSourceAdapter(SourceType.OTLP_TRACES).type).toBe('otlp.traces')
    })

    it('otlp.metrics adapter has type "otlp.metrics"', () => {
      expect(new OtlpSourceAdapter(SourceType.OTLP_METRICS).type).toBe('otlp.metrics')
    })
  })

  describe('getTopicStepKeys', () => {
    it('returns OTLP-relevant step keys', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_LOGS)
      const keys = adapter.getTopicStepKeys()
      expect(keys).toContain('otlp-signal-type')
      expect(keys).toContain('otlp-deduplication')
    })

    it('does NOT return kafka step keys', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_LOGS)
      const keys = adapter.getTopicStepKeys()
      expect(keys).not.toContain('kafka-connection')
      expect(keys).not.toContain('topic-selection-1')
    })
  })

  // ── toWireSource ────────────────────────────────────────────────────────────

  function makeOtlpStore(
    signalType = SourceType.OTLP_LOGS,
    sourceId = 'my-otlp-source',
    deduplication?: { enabled: boolean; key: string; time_window: string },
  ): SourceAdapterStoreState {
    return {
      otlpStore: {
        signalType,
        sourceId,
        deduplication: deduplication ?? null,
      },
      coreStore: { sourceType: signalType },
    }
  }

  describe('toWireSource — basic shape', () => {
    it('sets type from otlpStore.signalType', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_LOGS)
      const result = adapter.toWireSource(makeOtlpStore(SourceType.OTLP_LOGS))
      expect((result.source as any).type).toBe('otlp.logs')
    })

    it('sets id from otlpStore.sourceId', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_LOGS)
      const result = adapter.toWireSource(makeOtlpStore(SourceType.OTLP_LOGS, 'source-abc'))
      expect((result.source as any).id).toBe('source-abc')
    })

    it('supportsJoin is false', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_LOGS)
      expect(adapter.toWireSource(makeOtlpStore()).supportsJoin).toBe(false)
    })

    it('supportsSingleTopicFeatures is true', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_LOGS)
      expect(adapter.toWireSource(makeOtlpStore()).supportsSingleTopicFeatures).toBe(true)
    })
  })

  describe('toWireSource — OTLP Traces', () => {
    it('produces traces source', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_TRACES)
      const result = adapter.toWireSource(makeOtlpStore(SourceType.OTLP_TRACES, 'traces-src'))
      const src = result.source as any
      expect(src.type).toBe('otlp.traces')
      expect(src.id).toBe('traces-src')
    })
  })

  describe('toWireSource — OTLP Metrics', () => {
    it('produces metrics source', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_METRICS)
      const result = adapter.toWireSource(makeOtlpStore(SourceType.OTLP_METRICS, 'metrics-src'))
      const src = result.source as any
      expect(src.type).toBe('otlp.metrics')
    })
  })

  describe('toWireSource — deduplication absent', () => {
    it('does not include deduplication when disabled', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_LOGS)
      const result = adapter.toWireSource(makeOtlpStore())
      const src = result.source as any
      expect(src.deduplication).toBeUndefined()
    })
  })

  describe('toWireSource — deduplication present', () => {
    it('includes deduplication block when enabled', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_LOGS)
      const store = makeOtlpStore(SourceType.OTLP_LOGS, 'src', {
        enabled: true,
        key: 'trace_id',
        time_window: '5m',
      })
      const src = adapter.toWireSource(store).source as any
      expect(src.deduplication).toEqual({
        enabled: true,
        key: 'trace_id',
        time_window: '5m',
      })
    })

    it('does not include deduplication block when enabled=false', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_LOGS)
      const store = makeOtlpStore(SourceType.OTLP_LOGS, 'src', {
        enabled: false,
        key: '',
        time_window: '',
      })
      const src = adapter.toWireSource(store).source as any
      expect(src.deduplication).toBeUndefined()
    })
  })

  describe('fromWireSource', () => {
    it('calls hydrateOtlp with the wire config', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_LOGS)
      const hydrateOtlp = vi.fn()
      const wire = { source: { type: 'otlp.logs', id: 'src' } }

      adapter.fromWireSource(wire, { hydrateOtlp })

      expect(hydrateOtlp).toHaveBeenCalledWith(wire)
    })

    it('does not throw when hydrateOtlp is not provided', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_LOGS)
      expect(() => adapter.fromWireSource({}, {})).not.toThrow()
    })

    it('does not call kafka callbacks', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_LOGS)
      const hydrateKafkaConnection = vi.fn()
      const hydrateTopics = vi.fn()

      adapter.fromWireSource({}, { hydrateKafkaConnection, hydrateTopics })

      expect(hydrateKafkaConnection).not.toHaveBeenCalled()
      expect(hydrateTopics).not.toHaveBeenCalled()
    })
  })

  describe('roundtrip — toWireSource → fromWireSource', () => {
    it('hydrates from the produced wire source shape', () => {
      const adapter = new OtlpSourceAdapter(SourceType.OTLP_LOGS)
      const store = makeOtlpStore(SourceType.OTLP_LOGS, 'logs-src', {
        enabled: true,
        key: 'log_id',
        time_window: '10m',
      })

      const wireResult = adapter.toWireSource(store)

      const hydrateOtlp = vi.fn()
      // Simulate the wire config shape as it would come from the backend
      const backendConfig = { source: wireResult.source }
      adapter.fromWireSource(backendConfig, { hydrateOtlp })

      expect(hydrateOtlp).toHaveBeenCalledWith(backendConfig)
    })
  })
})
