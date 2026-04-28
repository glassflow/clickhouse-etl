'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/src/components/ui/select'
import { useSchemaRegistryState } from '@/src/modules/kafka/hooks/useSchemaRegistryState'
import { isRegistrySchema } from '@/src/modules/kafka/utils/schemaSource'

interface RegistrySchemaPanelProps {
  topicName: string
  topicIndex: number
  readOnly?: boolean
  liveEvent?: unknown
}

export function RegistrySchemaPanel({ topicName, topicIndex, readOnly, liveEvent }: RegistrySchemaPanelProps) {
  const { topicsStore } = useStore()
  const topic = topicsStore.getTopic(topicIndex)

  const {
    subjects,
    selectedSubject,
    versions,
    selectedVersion,
    isLoadingSubjects,
    isLoadingVersions,
    isLoadingSchema,
    schemaError,
    autoResolved,
    autoResolveDismissed,
    isResolvingFromEvent,
    selectSubject,
    selectVersion,
    resolveFromEvent,
    applyAutoResolved,
    dismissAutoResolved,
    clearAppliedSchema,
  } = useSchemaRegistryState(topicName, topicIndex)

  // All hooks before conditional returns
  const lastAttemptedRawBase64 = useRef<string | null>(null)
  const rawBase64 =
    (liveEvent as any)?._metadata?.rawBase64 ?? topic?.selectedEvent?.event?._metadata?.rawBase64

  useEffect(() => {
    if (!rawBase64 || rawBase64 === lastAttemptedRawBase64.current) return
    lastAttemptedRawBase64.current = rawBase64
    resolveFromEvent(rawBase64)
  }, [rawBase64]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!topicName) return null

  const schemaIsApplied = isRegistrySchema(topic?.schemaSource) && (topic?.schema?.fields?.length ?? 0) > 0
  const showAutoResolvedBanner = !!autoResolved && !autoResolveDismissed && !isResolvingFromEvent

  // State 4: schema applied
  if (schemaIsApplied) {
    return (
      <div className="space-y-2 pt-2">
        <p className="text-sm text-[var(--text-success)]">
          ✓ Schema applied — {topic?.schema?.fields?.length} field
          {topic?.schema?.fields?.length !== 1 ? 's' : ''} from {topic?.schemaRegistrySubject} v.
          {topic?.schemaRegistryVersion}
        </p>
        {!readOnly && (
          <Button
            variant="ghost"
            size="text"
            type="button"
            onClick={clearAppliedSchema}
            className="text-[var(--color-foreground-neutral-faded)]"
          >
            Continue with event-based detection
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-2">
      {/* Auto-detection prompt banner */}
      {showAutoResolvedBanner && (
        <div className="rounded-md border border-border bg-background-neutral-faded px-4 py-3 text-sm space-y-1">
          <div className="font-medium text-content">Schema detected in event</div>
          <div className="text-content-faded">
            {autoResolved!.subject && `${autoResolved!.subject} · `}
            {autoResolved!.version !== undefined && `Version ${autoResolved!.version} · `}
            {autoResolved!.fields.length} field{autoResolved!.fields.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-3 pt-1">
            <Button
              variant="link"
              size="text"
              type="button"
              onClick={applyAutoResolved}
              disabled={readOnly}
              className="text-[var(--text-link)]"
            >
              Use this schema
            </Button>
            <Button
              variant="ghost"
              size="text"
              type="button"
              onClick={dismissAutoResolved}
              disabled={readOnly}
              className="text-[var(--color-foreground-neutral-faded)]"
            >
              Ignore
            </Button>
          </div>
        </div>
      )}

      {/* Subject/version selection — always visible when topic is set */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-content">Schema from Registry</p>

        <div className="space-y-1">
          <label className="text-xs font-medium text-content-faded">Subject</label>
          <Select value={selectedSubject} onValueChange={selectSubject} disabled={readOnly || isLoadingSubjects}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={isLoadingSubjects ? 'Loading subjects…' : 'Select subject'} />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedSubject && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-content-faded">Version</label>
            <Select
              value={selectedVersion}
              onValueChange={selectVersion}
              disabled={readOnly || isLoadingVersions || isLoadingSchema}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    isLoadingVersions ? 'Loading versions…' : isLoadingSchema ? 'Loading schema…' : 'Select version'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">latest</SelectItem>
                {versions.map((v) => (
                  <SelectItem key={v.version} value={String(v.version)}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoadingSchema && (
          <p className="text-sm text-content-faded">Loading schema…</p>
        )}

        {schemaError && (
          <p className="text-sm text-destructive">{schemaError}</p>
        )}
      </div>
    </div>
  )
}
