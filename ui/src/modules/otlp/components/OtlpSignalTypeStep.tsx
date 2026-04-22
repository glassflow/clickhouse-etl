'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useStore } from '@/src/store'
import { SourceType, getOtlpSignalLabel } from '@/src/config/source-types'
import { getOtlpFieldsForSignalType } from '@/src/modules/otlp/constants'
import { OtlpSchemaPreview } from './OtlpSchemaPreview'
import { StepKeys } from '@/src/config/constants'
import { Card } from '@/src/components/ui/card'
import { cn } from '@/src/utils/common.client'
import FormActions from '@/src/components/shared/FormActions'

const SIGNAL_OPTIONS = [
  { type: SourceType.OTLP_LOGS, label: 'Logs', description: 'Ingest OpenTelemetry log records' },
  { type: SourceType.OTLP_TRACES, label: 'Traces', description: 'Ingest OpenTelemetry span/trace data' },
  { type: SourceType.OTLP_METRICS, label: 'Metrics', description: 'Ingest OpenTelemetry metric data points' },
]

export function OtlpSignalTypeStep({
  onCompleteStep,
}: {
  onCompleteStep: (stepName: string) => void
}) {
  const { coreStore, otlpStore } = useStore()
  const { sourceType } = coreStore
  const { signalType, setSignalType } = otlpStore

  // Keep coreStore.sourceType and otlpStore.signalType in sync.
  // enterCreateMode() resets coreStore to 'kafka', so if we navigate back into the OTLP
  // wizard while signalType is still set, we re-sync coreStore to avoid stale 'kafka' state.
  useEffect(() => {
    if (!signalType && sourceType && sourceType !== SourceType.KAFKA) {
      // Hydrating from an existing config: sourceType arrived before signalType
      setSignalType(sourceType as SourceType)
    } else if (signalType && (sourceType === SourceType.KAFKA || !sourceType)) {
      // coreStore was reset (e.g. enterCreateMode) but otlpStore still holds the signal type
      coreStore.setSourceType(signalType)
    }
  }, [signalType, sourceType, setSignalType, coreStore])

  const currentFields = useMemo(() => {
    return signalType ? getOtlpFieldsForSignalType(signalType) : []
  }, [signalType])

  const signalLabel = signalType ? getOtlpSignalLabel(signalType) : ''

  const handleSignalTypeChange = useCallback((type: SourceType) => {
    setSignalType(type)
    coreStore.setSourceType(type)
  }, [setSignalType, coreStore])

  const handleContinue = useCallback(() => {
    if (!signalType) return
    onCompleteStep(StepKeys.OTLP_SIGNAL_TYPE)
  }, [signalType, onCompleteStep])

  return (
    <div className="flex flex-col gap-8">
      {/* Signal type selector */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-[var(--color-foreground-neutral)]">Signal Type</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SIGNAL_OPTIONS.map((option) => (
            <Card
              key={option.type}
              variant="selectable"
              className={cn('cursor-pointer !p-0', signalType === option.type && 'active')}
            >
              <button
                className="flex flex-col items-start p-4 w-full h-full text-left"
                onClick={() => handleSignalTypeChange(option.type)}
              >
                <span className="text-sm font-medium text-[var(--color-foreground-neutral)]">
                  {option.label}
                </span>
                <span className="text-xs text-[var(--color-foreground-neutral-faded)] mt-1">
                  {option.description}
                </span>
              </button>
            </Card>
          ))}
        </div>
      </div>

      {/* Schema preview */}
      {signalType && (
        <OtlpSchemaPreview fields={currentFields} signalLabel={signalLabel} />
      )}

      <FormActions
        onSubmit={handleContinue}
        isLoading={false}
        isSuccess={false}
        disabled={!signalType}
        successText="Continue"
        loadingText="Loading..."
        regularText="Continue"
        actionType="primary"
        showLoadingIcon={false}
      />
    </div>
  )
}
