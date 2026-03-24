'use client'

import { useState, useCallback, useRef } from 'react'
import { useStore } from '@/src/store'
import { isRegistrySchema } from '@/src/modules/kafka/utils/schemaSource'

export interface AutoResolved {
  schemaId: number
  subject?: string
  version?: number
  fields: Array<{ name: string; type: string }>
}

export interface SchemaRegistryStateHook {
  subjects: string[]
  selectedSubject: string
  versions: Array<{ version: number | string; label: string }>
  selectedVersion: string
  isLoadingSubjects: boolean
  isLoadingVersions: boolean
  isLoadingSchema: boolean
  schemaError: string | undefined
  schemaLoaded: boolean
  schemaFieldCount: number
  autoResolved: AutoResolved | null
  isResolvingFromEvent: boolean
  fetchSubjects: () => Promise<void>
  selectSubject: (subject: string) => Promise<void>
  fetchVersionsForSubject: (subject: string) => Promise<void>
  selectVersion: (version: string) => void
  loadSchema: () => Promise<void>
  resolveFromEvent: (rawBase64: string) => Promise<void>
  applyAutoResolved: () => void
}

export function useSchemaRegistryState(topicName: string, topicIndex: number): SchemaRegistryStateHook {
  const { kafkaStore, topicsStore } = useStore()
  const { schemaRegistry } = kafkaStore

  // Read persisted registry state from topic store so selections survive navigation
  const initialTopic = topicsStore.getTopic(topicIndex)
  const initialSubject = initialTopic?.schemaRegistrySubject ?? ''
  const initialVersion = initialTopic?.schemaRegistryVersion ?? 'latest'
  const initialFieldCount = initialTopic?.schema?.fields?.length ?? 0
  const initialSchemaLoaded = isRegistrySchema(initialTopic?.schemaSource) && initialFieldCount > 0

  const [subjects, setSubjects] = useState<string[]>(initialSubject ? [initialSubject] : [])
  const [selectedSubject, setSelectedSubject] = useState(initialSubject)
  const [versions, setVersions] = useState<Array<{ version: number | string; label: string }>>([])
  const [selectedVersion, setSelectedVersion] = useState(initialVersion)
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false)
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [isLoadingSchema, setIsLoadingSchema] = useState(false)
  const [schemaError, setSchemaError] = useState<string | undefined>(undefined)
  const [schemaLoaded, setSchemaLoaded] = useState(initialSchemaLoaded)
  const [schemaFieldCount, setSchemaFieldCount] = useState(initialFieldCount)
  const [autoResolved, setAutoResolved] = useState<AutoResolved | null>(null)
  const [isResolvingFromEvent, setIsResolvingFromEvent] = useState(false)

  const authBody = {
    url: schemaRegistry?.url,
    authMethod: schemaRegistry?.authMethod,
    apiKey: schemaRegistry?.apiKey,
    apiSecret: schemaRegistry?.apiSecret,
    username: schemaRegistry?.username,
    password: schemaRegistry?.password,
  }

  const fetchSubjects = useCallback(async () => {
    if (!schemaRegistry?.url) return
    setIsLoadingSubjects(true)
    setSchemaError(undefined)
    try {
      const response = await fetch('/ui-api/kafka/schema-registry/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authBody, topicName }),
      })
      const data = await response.json()
      if (data.success) {
        setSubjects(data.subjects || [])
      } else {
        setSchemaError(data.error || 'Failed to load subjects')
      }
    } catch {
      setSchemaError('Could not reach Schema Registry')
    } finally {
      setIsLoadingSubjects(false)
    }
  }, [schemaRegistry, topicName]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectSubject = useCallback(
    async (subject: string) => {
      setSelectedSubject(subject)
      setVersions([])
      setSelectedVersion('latest')
      setSchemaLoaded(false)
      if (!schemaRegistry?.url || !subject) return
      setIsLoadingVersions(true)
      setSchemaError(undefined)
      try {
        const response = await fetch('/ui-api/kafka/schema-registry/versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...authBody, subject }),
        })
        const data = await response.json()
        if (data.success) {
          setVersions(data.versions || [])
        } else {
          setSchemaError(data.error || 'Failed to load versions')
        }
      } catch {
        setSchemaError('Could not reach Schema Registry')
      } finally {
        setIsLoadingVersions(false)
      }
    },
    [schemaRegistry], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Fetches versions for a subject without resetting the currently selected version.
  // Used when restoring persisted state on step re-entry.
  const fetchVersionsForSubject = useCallback(
    async (subject: string) => {
      if (!schemaRegistry?.url || !subject) return
      setIsLoadingVersions(true)
      try {
        const response = await fetch('/ui-api/kafka/schema-registry/versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...authBody, subject }),
        })
        const data = await response.json()
        if (data.success) {
          setVersions(data.versions || [])
        }
      } catch {
        // Non-fatal on restore
      } finally {
        setIsLoadingVersions(false)
      }
    },
    [schemaRegistry], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const selectVersion = useCallback((version: string) => {
    setSelectedVersion(version)
    setSchemaLoaded(false)
  }, [])

  const loadSchema = useCallback(async () => {
    if (!schemaRegistry?.url || !selectedSubject) return
    setIsLoadingSchema(true)
    setSchemaError(undefined)
    setSchemaLoaded(false)
    try {
      const response = await fetch('/ui-api/kafka/schema-registry/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authBody, subject: selectedSubject, version: selectedVersion }),
      })
      const data = await response.json()
      if (data.success && data.fields) {
        const topic = topicsStore.getTopic(topicIndex)
        if (topic) {
          topicsStore.updateTopic({
            ...topic,
            schemaSource: 'external',
            schemaRegistrySubject: selectedSubject,
            schemaRegistryVersion: selectedVersion,
            schema: {
              fields: data.fields.map((f: { name: string; type: string }) => ({
                name: f.name,
                type: f.type,
                userType: f.type,
              })),
            },
          })
        }
        setSchemaFieldCount(data.fields.length)
        setSchemaLoaded(true)
      } else {
        setSchemaError(data.error || 'Failed to load schema')
      }
    } catch {
      setSchemaError('Could not reach Schema Registry')
    } finally {
      setIsLoadingSchema(false)
    }
  }, [schemaRegistry, selectedSubject, selectedVersion, topicIndex, topicsStore]) // eslint-disable-line react-hooks/exhaustive-deps

  const resolveFromEvent = useCallback(
    async (rawBase64: string) => {
      if (!schemaRegistry?.url) return
      setIsResolvingFromEvent(true)
      try {
        const response = await fetch('/ui-api/kafka/schema-registry/resolve-from-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...authBody, rawBase64 }),
        })
        const data = await response.json()
        if (data.success && data.fields?.length > 0) {
          setAutoResolved({ schemaId: data.schemaId, subject: data.subject, version: data.version, fields: data.fields })
        } else {
          setAutoResolved(null)
        }
      } catch {
        setAutoResolved(null)
      } finally {
        setIsResolvingFromEvent(false)
      }
    },
    [schemaRegistry], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const applyAutoResolved = useCallback(() => {
    if (!autoResolved) return
    const topic = topicsStore.getTopic(topicIndex)
    if (!topic) return
    topicsStore.updateTopic({
      ...topic,
      schemaSource: 'registry_resolved_from_event',
      schemaRegistrySubject: autoResolved.subject,
      schemaRegistryVersion: autoResolved.version !== undefined ? String(autoResolved.version) : undefined,
      schema: {
        fields: autoResolved.fields.map((f) => ({
          name: f.name,
          type: f.type,
          userType: f.type,
        })),
      },
    })
  }, [autoResolved, topicIndex, topicsStore])

  return {
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
    isResolvingFromEvent,
    fetchSubjects,
    selectSubject,
    fetchVersionsForSubject,
    selectVersion,
    loadSchema,
    resolveFromEvent,
    applyAutoResolved,
  }
}
