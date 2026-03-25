'use client'

import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/src/store'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/src/components/ui/select'
import { useSchemaRegistryState } from '@/src/modules/kafka/hooks/useSchemaRegistryState'

interface SchemaSourceSelectorProps {
  topicName: string
  topicIndex: number
  readOnly?: boolean
  liveEvent?: unknown
}

export function SchemaSourceSelector({ topicName, topicIndex, readOnly, liveEvent }: SchemaSourceSelectorProps) {
  const { topicsStore, kafkaStore } = useStore()
  const topic = topicsStore.getTopic(topicIndex)
  // When no topic exists in the store yet (user hasn't selected one), track the
  // preference locally so the radio is interactive. Apply it once the topic appears.
  const [pendingSchemaSource, setPendingSchemaSource] = useState<'internal' | 'external'>('internal')
  const schemaSource = topic?.schemaSource ?? pendingSchemaSource

  // Once a topic appears in the store, apply any pending non-default preference
  useEffect(() => {
    if (topic && pendingSchemaSource !== 'internal' && topic.schemaSource === undefined) {
      topicsStore.updateTopic({ ...topic, schemaSource: pendingSchemaSource })
    }
  }, [topic?.index]) // eslint-disable-line react-hooks/exhaustive-deps

  const {
    subjects,
    selectedSubject,
    versions,
    selectedVersion,
    isLoadingSubjects,
    isLoadingVersions,
    isLoadingSchema,
    schemaError,
    schemaLoaded,
    schemaFieldCount,
    autoResolved,
    autoResolutionAttempted,
    isResolvingFromEvent,
    fetchSubjects,
    selectSubject,
    fetchVersionsForSubject,
    selectVersion,
    loadSchema,
    resolveFromEvent,
    applyAutoResolved,
  } = useSchemaRegistryState(topicName, topicIndex)

  // On mount: restore full subjects list (and versions for persisted subject) if registry is active.
  // This covers the case where the user navigates back to this step after already selecting a schema.
  useEffect(() => {
    if (!kafkaStore.schemaRegistry?.enabled) return
    if (schemaSource !== 'external' && schemaSource !== 'registry_resolved_from_event') return
    fetchSubjects()
    if (selectedSubject) {
      fetchVersionsForSubject(selectedSubject)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resolve from event when raw bytes are available and registry is enabled
  const lastAttemptedRawBase64 = useRef<string | null>(null)
  // Prefer the live (pre-submit) event; fall back to stored topic event for edit/revisit mode
  const rawBase64 =
    (liveEvent as any)?._metadata?.rawBase64 ?? topic?.selectedEvent?.event?._metadata?.rawBase64

  useEffect(() => {
    if (!rawBase64 || rawBase64 === lastAttemptedRawBase64.current) return
    if (!kafkaStore.schemaRegistry?.enabled) return
    lastAttemptedRawBase64.current = rawBase64
    resolveFromEvent(rawBase64)
  }, [rawBase64, kafkaStore.schemaRegistry?.enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch subjects when user explicitly switches to external schema source
  useEffect(() => {
    if (schemaSource === 'external' && subjects.length === 0 && !isLoadingSubjects) {
      fetchSubjects()
    }
  }, [schemaSource]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSchemaSourceChange = (source: 'internal' | 'external') => {
    if (readOnly) return
    if (topic) {
      topicsStore.updateTopic({ ...topic, schemaSource: source })
    } else {
      setPendingSchemaSource(source)
    }
    if (source === 'external' && subjects.length === 0) {
      fetchSubjects()
    }
  }

  const handleUseAutoResolved = () => {
    applyAutoResolved()
  }

  const isRegistryActive = schemaSource === 'external' || schemaSource === 'registry_resolved_from_event'

  const eventAvailable = !!liveEvent || !!topic?.selectedEvent?.event
  const showNoSchemaWarning =
    schemaSource === 'internal' &&
    eventAvailable &&
    !isResolvingFromEvent &&
    autoResolved === null &&
    (rawBase64 ? autoResolutionAttempted : true)

  return (
    <div className="space-y-3 pt-2">
      {/* Confluent wire format hint banner */}
      {autoResolved && schemaSource !== 'registry_resolved_from_event' && !isResolvingFromEvent && (
        <div className="rounded-md border border-border bg-background-neutral-faded px-4 py-3 text-sm space-y-1">
          <div className="font-medium text-content">
            Confluent schema ID {autoResolved.schemaId} detected in event
          </div>
          {autoResolved.subject && (
            <div className="text-content-faded">
              Subject: {autoResolved.subject}
              {autoResolved.version !== undefined && ` · Version: ${autoResolved.version}`}
            </div>
          )}
          <button
            type="button"
            onClick={handleUseAutoResolved}
            disabled={readOnly}
            className="text-sm font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use this schema
          </button>
        </div>
      )}

      {schemaSource === 'registry_resolved_from_event' && (
        <div className="rounded-md border border-border bg-background-neutral-faded px-4 py-3 text-sm space-y-1">
          <div className="font-medium text-content-success">
            Schema auto-resolved from event
          </div>
          {topic?.schemaRegistrySubject && (
            <div className="text-content-faded">
              Subject: {topic.schemaRegistrySubject}
              {topic.schemaRegistryVersion && ` · Version: ${topic.schemaRegistryVersion}`}
            </div>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => handleSchemaSourceChange('internal')}
              className="text-sm text-content-faded hover:underline"
            >
              Switch to auto-detect instead
            </button>
          )}
        </div>
      )}

      <p className="text-sm font-medium text-content">Schema Source</p>

      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`schemaSource-${topicIndex}`}
            value="internal"
            checked={schemaSource === 'internal'}
            onChange={() => handleSchemaSourceChange('internal')}
            disabled={readOnly}
            className="accent-primary"
          />
          <span className="text-sm">Auto-detect from events</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`schemaSource-${topicIndex}`}
            value="external"
            checked={isRegistryActive}
            onChange={() => handleSchemaSourceChange('external')}
            disabled={readOnly}
            className="accent-primary"
          />
          <span className="text-sm">Load from Schema Registry</span>
        </label>
      </div>

      {showNoSchemaWarning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm space-y-1">
          <div className="font-medium text-amber-800">
            Schema not found in this event
          </div>
          <div className="text-amber-700">
            No schema information was detected automatically. You can select a schema manually from the registry, or
            continue — GlassFlow will infer the schema from the event data and you&apos;ll be able to make corrections
            later.
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => handleSchemaSourceChange('external')}
              className="text-sm font-medium text-amber-900 hover:underline"
            >
              Select schema manually
            </button>
          )}
        </div>
      )}

      {schemaSource === 'external' && (
        <div className="pl-6 space-y-3">
          {/* Subject selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-content-faded">Subject</label>
            <Select
              value={selectedSubject}
              onValueChange={(v) => selectSubject(v)}
              disabled={readOnly || isLoadingSubjects}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={isLoadingSubjects ? 'Loading subjects…' : 'Select subject'} />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Version selector */}
          {selectedSubject && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-content-faded">Version</label>
              <Select
                value={selectedVersion}
                onValueChange={selectVersion}
                disabled={readOnly || isLoadingVersions}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={isLoadingVersions ? 'Loading versions…' : 'Select version'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">latest</SelectItem>
                  {versions.map((v) => (
                    <SelectItem key={v.version} value={String(v.version)}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Load schema button */}
          {selectedSubject && (
            <button
              type="button"
              onClick={loadSchema}
              disabled={readOnly || isLoadingSchema}
              className="text-sm font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingSchema ? 'Loading schema…' : 'Load Schema'}
            </button>
          )}

          {/* Success message */}
          {schemaLoaded && (
            <p className="text-sm text-content-success">
              Schema loaded — {schemaFieldCount} field{schemaFieldCount !== 1 ? 's' : ''} from {selectedSubject}{' '}
              {selectedVersion !== 'latest' ? `v${selectedVersion}` : '(latest)'}
            </p>
          )}

          {/* Error message */}
          {schemaError && !schemaLoaded && (
            <p className="text-sm text-destructive">{schemaError}. You can continue with auto-detect instead.</p>
          )}
        </div>
      )}
    </div>
  )
}
