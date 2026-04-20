'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
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

const TIME_WINDOW_OPTIONS = [
  { label: '1 minute', value: '1m' },
  { label: '5 minutes', value: '5m' },
  { label: '15 minutes', value: '15m' },
  { label: '1 hour', value: '1h' },
  { label: '24 hours', value: '24h' },
]

export function OtlpSignalTypeStep({
  onCompleteStep,
}: {
  onCompleteStep: (stepName: string) => void
}) {
  const { coreStore, otlpStore } = useStore()
  const { sourceType } = coreStore
  const { signalType, deduplication, schemaFields, setSignalType, setDeduplication, skipDeduplication, markAsValid } = otlpStore

  const [dedupEnabled, setDedupEnabled] = useState(deduplication.enabled)

  // Keep coreStore.sourceType and otlpStore.signalType in sync.
  // enterCreateMode() resets coreStore to 'kafka', so if we navigate back into the OTLP
  // wizard while signalType is still set, we re-sync coreStore to avoid stale 'kafka' state.
  useEffect(() => {
    if (!signalType && sourceType && sourceType !== 'kafka') {
      // Hydrating from an existing config: sourceType arrived before signalType
      setSignalType(sourceType as SourceType)
    } else if (signalType && (sourceType === 'kafka' || !sourceType)) {
      // coreStore was reset (e.g. enterCreateMode) but otlpStore still holds the signal type
      coreStore.setSourceType(signalType)
    }
  }, [signalType, sourceType, setSignalType, coreStore])

  const currentFields = useMemo(() => {
    return signalType ? getOtlpFieldsForSignalType(signalType) : []
  }, [signalType])

  const signalLabel = signalType ? getOtlpSignalLabel(signalType) : ''

  // Dedup field options from the predefined schema
  const dedupFieldOptions = useMemo(() => {
    return currentFields
      .filter((f) => f.type === 'string' || f.type === 'uint' || f.type === 'int')
      .map((f) => ({ label: f.name, value: f.name, type: f.type }))
  }, [currentFields])

  const handleSignalTypeChange = useCallback((type: SourceType) => {
    setSignalType(type)
    coreStore.setSourceType(type)
    setDedupEnabled(false)
  }, [setSignalType, coreStore])

  const handleDedupToggle = useCallback(() => {
    const newEnabled = !dedupEnabled
    setDedupEnabled(newEnabled)
    if (!newEnabled) {
      skipDeduplication()
    } else {
      setDeduplication({ enabled: true })
    }
  }, [dedupEnabled, setDeduplication, skipDeduplication])

  const handleDedupFieldChange = useCallback((fieldName: string) => {
    setDeduplication({
      enabled: true,
      key: fieldName,
    })
  }, [setDeduplication])

  const handleDedupTimeWindowChange = useCallback((timeWindow: string) => {
    setDeduplication({ time_window: timeWindow })
  }, [setDeduplication])

  const handleContinue = useCallback(() => {
    if (!signalType) return
    markAsValid()
    onCompleteStep(StepKeys.OTLP_SIGNAL_TYPE)
  }, [signalType, markAsValid, onCompleteStep])

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
              className={cn('cursor-pointer', signalType === option.type && 'active')}
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

      {/* Deduplication config (collapsible) */}
      {signalType && (
        <div className="space-y-4 rounded-lg border border-[var(--color-border-neutral-faded)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-[var(--color-foreground-neutral)]">Deduplication</h4>
              <p className="text-xs text-[var(--color-foreground-neutral-faded)] mt-0.5">
                Optionally deduplicate incoming data by a key field
              </p>
            </div>
            <button
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                dedupEnabled
                  ? 'bg-[var(--color-foreground-primary)]'
                  : 'bg-[var(--color-border-neutral-faded)]',
              )}
              onClick={handleDedupToggle}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  dedupEnabled ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
          </div>

          {dedupEnabled && (
            <div className="flex gap-3 pt-2">
              <div className="flex flex-col gap-1.5 flex-[3] min-w-0">
                <label className="text-xs font-medium text-[var(--color-foreground-neutral-faded)]">
                  Deduplication Key
                </label>
                <select
                  className="w-full rounded-md border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm text-[var(--color-foreground-neutral)] focus:border-[var(--control-border-focus)] focus:shadow-[var(--control-shadow-focus)]"
                  value={deduplication.key}
                  onChange={(e) => handleDedupFieldChange(e.target.value)}
                >
                  <option value="">Select a field...</option>
                  {dedupFieldOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 flex-[1] min-w-0">
                <label className="text-xs font-medium text-[var(--color-foreground-neutral-faded)]">
                  Time Window
                </label>
                <select
                  className="w-full rounded-md border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm text-[var(--color-foreground-neutral)] focus:border-[var(--control-border-focus)] focus:shadow-[var(--control-shadow-focus)]"
                  value={deduplication.time_window}
                  onChange={(e) => handleDedupTimeWindowChange(e.target.value)}
                >
                  {TIME_WINDOW_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Continue button */}
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
