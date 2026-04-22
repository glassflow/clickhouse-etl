'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '@/src/store'
import { getOtlpFieldsForSignalType } from '@/src/modules/otlp/constants'
import { StepKeys } from '@/src/config/constants'
import FormActions from '@/src/components/shared/FormActions'
import { TimeWindowConfigurator } from '@/src/modules/deduplication/components/TimeWindowConfigurator'

const UNIT_SUFFIX: Record<string, string> = { seconds: 's', minutes: 'm', hours: 'h', days: 'd' }
const SUFFIX_UNIT: Record<string, string> = { s: 'seconds', m: 'minutes', h: 'hours', d: 'days' }

function parseTimeWindow(tw: string): { window: number; unit: string } {
  const match = tw.match(/^(\d+)([smhd])$/)
  if (!match) return { window: 5, unit: 'minutes' }
  return { window: parseInt(match[1]), unit: SUFFIX_UNIT[match[2]] ?? 'minutes' }
}

function serializeTimeWindow(window: number, unit: string): string {
  return `${window}${UNIT_SUFFIX[unit] ?? 'm'}`
}

export function OtlpDeduplicationStep({
  onCompleteStep,
  standalone,
  readOnly,
  toggleEditMode,
  pipelineActionState,
  onCompleteStandaloneEditing,
}: {
  onCompleteStep: (stepName: string) => void
  standalone?: boolean
  readOnly?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
  onCompleteStandaloneEditing?: () => void
}) {
  const { otlpStore, coreStore } = useStore()
  const { signalType, deduplication, setDeduplication, skipDeduplication, markAsValid } = otlpStore

  const [dedupEnabled, setDedupEnabled] = useState(deduplication.enabled)
  const [dedupWindow, setDedupWindow] = useState(() => parseTimeWindow(deduplication.time_window || '5m').window)
  const [dedupWindowUnit, setDedupWindowUnit] = useState(() => parseTimeWindow(deduplication.time_window || '5m').unit)

  useEffect(() => {
    const parsed = parseTimeWindow(deduplication.time_window || '5m')
    setDedupWindow(parsed.window)
    setDedupWindowUnit(parsed.unit)
  }, [deduplication.time_window])

  const currentFields = useMemo(() => {
    return signalType ? getOtlpFieldsForSignalType(signalType) : []
  }, [signalType])

  const dedupFieldOptions = useMemo(() => {
    return currentFields
      .filter((f) => f.type === 'string' || f.type === 'uint' || f.type === 'int')
      .map((f) => ({ label: f.name, value: f.name, type: f.type }))
  }, [currentFields])

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
    setDeduplication({ enabled: true, key: fieldName })
  }, [setDeduplication])

  const handleDedupWindowChange = useCallback((value: number) => {
    setDedupWindow(value)
    setDeduplication({ time_window: serializeTimeWindow(value, dedupWindowUnit) })
  }, [setDeduplication, dedupWindowUnit])

  const handleDedupWindowUnitChange = useCallback((unit: string) => {
    setDedupWindowUnit(unit)
    setDeduplication({ time_window: serializeTimeWindow(dedupWindow, unit) })
  }, [setDeduplication, dedupWindow])

  const [isSaveSuccess, setIsSaveSuccess] = useState(false)

  useEffect(() => {
    if (!readOnly && isSaveSuccess) setIsSaveSuccess(false)
  }, [readOnly, isSaveSuccess])

  const handleContinue = useCallback(() => {
    if (!dedupEnabled) {
      skipDeduplication()
    }
    markAsValid()

    if (standalone && toggleEditMode) {
      coreStore.markAsDirty()
      setIsSaveSuccess(true)
      onCompleteStandaloneEditing?.()
    } else {
      onCompleteStep(StepKeys.OTLP_DEDUPLICATION)
    }
  }, [dedupEnabled, skipDeduplication, markAsValid, standalone, toggleEditMode, coreStore, onCompleteStandaloneEditing, onCompleteStep])

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-4 rounded-lg border border-[var(--color-border-neutral-faded)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-[var(--color-foreground-neutral)]">Deduplication</h4>
            <p className="text-xs text-[var(--color-foreground-neutral-faded)] mt-0.5">
              Deduplicate incoming data by a key field within a time window
            </p>
          </div>
          <button
            className={[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              dedupEnabled
                ? 'bg-[var(--color-foreground-primary)]'
                : 'bg-[var(--color-border-neutral-faded)]',
              readOnly ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
            onClick={readOnly ? undefined : handleDedupToggle}
            disabled={readOnly}
          >
            <span
              className={[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                dedupEnabled ? 'translate-x-6' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>

        {dedupEnabled && (
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-foreground-neutral-faded)]">
                Deduplication Key
              </label>
              <select
                className="w-full rounded-md border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm text-[var(--color-foreground-neutral)] focus:border-[var(--control-border-focus)] focus:shadow-[var(--control-shadow-focus)] disabled:opacity-50 disabled:cursor-not-allowed"
                value={deduplication.key}
                onChange={(e) => handleDedupFieldChange(e.target.value)}
                disabled={readOnly}
              >
                <option value="">Select a field...</option>
                {dedupFieldOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.type})
                  </option>
                ))}
              </select>
            </div>

            <TimeWindowConfigurator
              window={dedupWindow}
              setWindow={handleDedupWindowChange}
              windowUnit={dedupWindowUnit}
              setWindowUnit={handleDedupWindowUnitChange}
              readOnly={readOnly}
            />
          </div>
        )}
      </div>

      <FormActions
        onSubmit={handleContinue}
        isLoading={false}
        isSuccess={isSaveSuccess}
        disabled={false}
        standalone={standalone}
        readOnly={readOnly}
        toggleEditMode={toggleEditMode}
        pipelineActionState={pipelineActionState}
        successText="Saved"
        loadingText="Saving..."
        regularText={standalone ? 'Save' : 'Continue'}
        actionType="primary"
        showLoadingIcon={false}
      />
    </div>
  )
}
