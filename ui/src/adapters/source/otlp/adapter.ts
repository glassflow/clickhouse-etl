/**
 * OTLP source adapter.
 *
 * toWireSource: builds the `source` section for OTLP signals (logs/traces/metrics).
 * fromWireSource: dispatches to hydrateOtlp callback.
 */

import { StepKeys } from '@/src/config/constants'
import { SourceType } from '@/src/config/source-types'
import type {
  SourceAdapter,
  SourceAdapterStoreState,
  SourceWireResult,
  AdapterDispatch,
} from '@/src/types/adapters'

// Local shapes for the store fields this adapter reads.
interface OtlpStoreShape {
  signalType?: string | null
  sourceId?: string
  deduplication?: {
    enabled?: boolean
    key?: string
    time_window?: string
  }
}

interface CoreStoreShape {
  sourceType?: string
}

export class OtlpSourceAdapter implements SourceAdapter {
  readonly type: 'otlp.logs' | 'otlp.traces' | 'otlp.metrics'
  readonly supportsJoin = false
  readonly supportsSingleTopicFeatures = true

  constructor(signalType: 'otlp.logs' | 'otlp.traces' | 'otlp.metrics') {
    this.type = signalType
  }

  toWireSource(storeState: SourceAdapterStoreState): SourceWireResult {
    const otlpStore = storeState.otlpStore as OtlpStoreShape
    const coreStore = storeState.coreStore as CoreStoreShape

    const signalType: string = otlpStore?.signalType ?? coreStore?.sourceType ?? SourceType.OTLP_LOGS
    const sourceId: string = otlpStore?.sourceId ?? ''
    const dedup = otlpStore?.deduplication

    const sourceObj: Record<string, unknown> = {
      type: signalType,
      id: sourceId,
    }

    if (dedup?.enabled) {
      sourceObj.deduplication = {
        enabled: true,
        key: dedup.key,
        time_window: dedup.time_window,
      }
    }

    return {
      source: sourceObj,
      supportsJoin: false,
      supportsSingleTopicFeatures: true,
    }
  }

  fromWireSource(wire: unknown, dispatch: AdapterDispatch): void {
    if (dispatch.hydrateOtlp) {
      dispatch.hydrateOtlp(wire)
    }
  }

  getTopicStepKeys(): string[] {
    return [
      StepKeys.OTLP_SIGNAL_TYPE,
      StepKeys.OTLP_DEDUPLICATION,
    ]
  }
}
