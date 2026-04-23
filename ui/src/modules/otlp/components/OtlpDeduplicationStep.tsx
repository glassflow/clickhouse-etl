'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@/src/store'
import { getOtlpFieldsForSignalType } from '@/src/modules/otlp/constants'
import { StepKeys } from '@/src/config/constants'
import FormActions from '@/src/components/shared/FormActions'
import { TimeWindowConfigurator } from '@/src/modules/deduplication/components/TimeWindowConfigurator'
import { SearchableSelect } from '@/src/components/common/SearchableSelect'
import { Label } from '@/src/components/ui/label'
import { Button } from '@/src/components/ui/button'

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

  // Snapshot dedup state on mount so discard can restore it
  const snapshot = useRef({ ...deduplication })

  const [dedupKey, setDedupKey] = useState(deduplication.key || '')
  const [dedupWindow, setDedupWindow] = useState(() => parseTimeWindow(deduplication.time_window || '5m').window)
  const [dedupWindowUnit, setDedupWindowUnit] = useState(() => parseTimeWindow(deduplication.time_window || '5m').unit)

  // Sync local state when store changes (e.g. hydration)
  useEffect(() => {
    setDedupKey(deduplication.key || '')
    const parsed = parseTimeWindow(deduplication.time_window || '5m')
    setDedupWindow(parsed.window)
    setDedupWindowUnit(parsed.unit)
  }, [deduplication.key, deduplication.time_window])

  const dedupFieldOptions = useMemo(() => {
    const fields = signalType ? getOtlpFieldsForSignalType(signalType) : []
    return fields
      .filter((f) => f.type === 'string' || f.type === 'uint' || f.type === 'int')
      .map((f) => f.name)
  }, [signalType])

  const handleKeyChange = useCallback(
    (key: string | null) => {
      const newKey = key || ''
      setDedupKey(newKey)
      setDeduplication({ key: newKey, enabled: newKey !== '' })
    },
    [setDeduplication],
  )

  const handleWindowChange = useCallback(
    (value: number) => {
      setDedupWindow(value)
      setDeduplication({ time_window: serializeTimeWindow(value, dedupWindowUnit) })
    },
    [setDeduplication, dedupWindowUnit],
  )

  const handleWindowUnitChange = useCallback(
    (unit: string) => {
      setDedupWindowUnit(unit)
      setDeduplication({ time_window: serializeTimeWindow(dedupWindow, unit) })
    },
    [setDeduplication, dedupWindow],
  )

  const handleDiscard = useCallback(() => {
    const prev = snapshot.current
    setDeduplication({ ...prev })
    setDedupKey(prev.key || '')
    const parsed = parseTimeWindow(prev.time_window || '5m')
    setDedupWindow(parsed.window)
    setDedupWindowUnit(parsed.unit)
  }, [setDeduplication])

  const [isSaveSuccess, setIsSaveSuccess] = useState(false)

  useEffect(() => {
    if (!readOnly && isSaveSuccess) setIsSaveSuccess(false)
  }, [readOnly, isSaveSuccess])

  const handleContinue = useCallback(() => {
    if (dedupKey) {
      setDeduplication({ enabled: true, key: dedupKey, time_window: serializeTimeWindow(dedupWindow, dedupWindowUnit) })
    } else {
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
  }, [dedupKey, dedupWindow, dedupWindowUnit, setDeduplication, skipDeduplication, markAsValid, standalone, toggleEditMode, coreStore, onCompleteStandaloneEditing, onCompleteStep])

  const handleSkip = useCallback(() => {
    skipDeduplication()
    markAsValid()
    onCompleteStep(StepKeys.OTLP_DEDUPLICATION)
  }, [skipDeduplication, markAsValid, onCompleteStep])

  return (
    <div className="flex flex-col gap-8">
      <div className="text-sm text-[var(--color-foreground-neutral-faded)]">
        The deduplicate key will be used to detect and remove duplicate data in your pipeline.
      </div>

      <div className="space-y-4">
        <Label className="text-lg font-medium text-[var(--color-foreground-neutral)]">Deduplicate Key</Label>
        <div className="flex gap-2 w-full">
          <div className="w-[70%]">
            <SearchableSelect
              availableOptions={dedupFieldOptions}
              selectedOption={dedupKey}
              onSelect={handleKeyChange}
              placeholder="Enter de-duplicate key"
              clearable={true}
              readOnly={readOnly}
            />
          </div>
          <div className="w-[30%]" />
        </div>
      </div>

      <TimeWindowConfigurator
        window={dedupWindow}
        setWindow={handleWindowChange}
        windowUnit={dedupWindowUnit}
        setWindowUnit={handleWindowUnitChange}
        readOnly={readOnly}
      />

      <div className="flex gap-4 items-center">
        <FormActions
          onSubmit={handleContinue}
          onDiscard={handleDiscard}
          isLoading={false}
          isSuccess={isSaveSuccess}
          disabled={false}
          standalone={standalone}
          readOnly={readOnly}
          toggleEditMode={toggleEditMode}
          pipelineActionState={pipelineActionState}
          onClose={onCompleteStandaloneEditing}
          successText="Saved"
          loadingText="Saving..."
          regularText={standalone ? 'Save' : 'Continue'}
          actionType="primary"
          showLoadingIcon={false}
        />
        {!standalone && (
          <Button
            onClick={handleSkip}
            variant="tertiary"
            className="text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)]"
          >
            Skip deduplication
          </Button>
        )}
      </div>
    </div>
  )
}
