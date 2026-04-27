/**
 * OTLP source adapter.
 *
 * toWireSource: builds the `source` section for OTLP signals (logs/traces/metrics).
 * fromWireSource: dispatches to hydrateOtlp callback.
 */

import { StepKeys } from '@/src/config/constants'
import type {
  SourceAdapter,
  SourceAdapterStoreState,
  SourceWireResult,
  AdapterDispatch,
} from '@/src/types/adapters'

export class OtlpSourceAdapter implements SourceAdapter {
  readonly type: string

  constructor(signalType: string) {
    this.type = signalType
  }

  toWireSource(storeState: SourceAdapterStoreState): SourceWireResult {
    const otlpStore = storeState.otlpStore as any
    const coreStore = storeState.coreStore as any

    const signalType: string = otlpStore?.signalType ?? coreStore?.sourceType ?? 'otlp.logs'
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
