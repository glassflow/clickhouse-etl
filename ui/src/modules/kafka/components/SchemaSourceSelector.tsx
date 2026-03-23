'use client'

import { useEffect } from 'react'
import { useStore } from '@/src/store'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/src/components/ui/select'
import { useSchemaRegistryState } from '@/src/modules/kafka/hooks/useSchemaRegistryState'

interface SchemaSourceSelectorProps {
  topicName: string
  topicIndex: number
  readOnly?: boolean
}

export function SchemaSourceSelector({ topicName, topicIndex, readOnly }: SchemaSourceSelectorProps) {
  const { topicsStore } = useStore()
  const topic = topicsStore.getTopic(topicIndex)
  const schemaSource = topic?.schemaSource ?? 'internal'

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
    fetchSubjects,
    selectSubject,
    selectVersion,
    loadSchema,
  } = useSchemaRegistryState(topicName, topicIndex)

  // Fetch subjects when user switches to external schema source
  useEffect(() => {
    if (schemaSource === 'external' && subjects.length === 0 && !isLoadingSubjects) {
      fetchSubjects()
    }
  }, [schemaSource]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSchemaSourceChange = (source: 'internal' | 'external') => {
    if (readOnly || !topic) return
    topicsStore.updateTopic({ ...topic, schemaSource: source })
    if (source === 'external' && subjects.length === 0) {
      fetchSubjects()
    }
  }

  return (
    <div className="space-y-3 pt-2">
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
            checked={schemaSource === 'external'}
            onChange={() => handleSchemaSourceChange('external')}
            disabled={readOnly}
            className="accent-primary"
          />
          <span className="text-sm">Load from Schema Registry</span>
        </label>
      </div>

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
