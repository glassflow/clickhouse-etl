'use client'

import { useState, useCallback, useEffect } from 'react'
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
  autoResolveDismissed: boolean
  autoResolutionAttempted: boolean
  isResolvingFromEvent: boolean
  fetchSubjects: () => Promise<void>
  selectSubject: (subject: string) => Promise<void>
  fetchVersionsForSubject: (subject: string) => Promise<void>
  selectVersion: (version: string) => void
  resolveFromEvent: (rawBase64: string) => Promise<void>
  applyAutoResolved: () => void
  dismissAutoResolved: () => void
  clearAppliedSchema: () => void
}

export function useSchemaRegistryState(topicName: string, topicIndex: number): SchemaRegistryStateHook {
  const { kafkaStore, topicsStore } = useStore()
  const { schemaRegistry } = kafkaStore

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
  const [autoResolveDismissed, setAutoResolveDismissed] = useState(false)
  const [autoResolutionAttempted, setAutoResolutionAttempted] = useState(false)
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
        if (data.success) setVersions(data.versions || [])
      } catch {
        // Non-fatal on restore
      } finally {
        setIsLoadingVersions(false)
      }
    },
    [schemaRegistry], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Fetch subjects (and restore versions) whenever a topic is selected
  useEffect(() => {
    if (!topicName || !schemaRegistry?.url) return
    fetchSubjects()
    if (selectedSubject) fetchVersionsForSubject(selectedSubject)
  }, [topicName]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectSubject = useCallback(
    async (subject: string) => {
      setSelectedSubject(subject)
      setVersions([])
      setSelectedVersion('latest')
      setSchemaLoaded(false)
      setSchemaError(undefined)
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

  // Extracted so selectVersion can call it with the new version before state settles
  const loadSchemaForSubjectVersion = useCallback(
    async (subject: string, version: string) => {
      if (!schemaRegistry?.url || !subject) return
      setIsLoadingSchema(true)
      setSchemaError(undefined)
      setSchemaLoaded(false)
      try {
        const response = await fetch('/ui-api/kafka/schema-registry/schema', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...authBody, subject, version }),
        })
        const data = await response.json()
        if (data.success && data.fields) {
          const topic = topicsStore.getTopic(topicIndex)
          if (topic) {
            const resolvedVersion = data.version !== undefined ? String(data.version) : version
            topicsStore.updateTopic({
              ...topic,
              schemaSource: 'external',
              schemaRegistrySubject: subject,
              schemaRegistryVersion: resolvedVersion,
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
    },
    [schemaRegistry, topicIndex, topicsStore], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const selectVersion = useCallback(
    (version: string) => {
      setSelectedVersion(version)
      setSchemaLoaded(false)
      if (selectedSubject) loadSchemaForSubjectVersion(selectedSubject, version)
    },
    [selectedSubject, loadSchemaForSubjectVersion],
  )

  const resolveFromEvent = useCallback(
    async (rawBase64: string) => {
      if (!schemaRegistry?.url) return
      setAutoResolveDismissed(false)
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
        setAutoResolutionAttempted(true)
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
        fields: autoResolved.fields.map((f) => ({ name: f.name, type: f.type, userType: f.type })),
      },
    })
    setSchemaFieldCount(autoResolved.fields.length)
    setSchemaLoaded(true)
  }, [autoResolved, topicIndex, topicsStore])

  const dismissAutoResolved = useCallback(() => {
    setAutoResolveDismissed(true)
  }, [])

  const clearAppliedSchema = useCallback(() => {
    const topic = topicsStore.getTopic(topicIndex)
    if (!topic) return
    topicsStore.updateTopic({
      ...topic,
      schemaSource: 'internal',
      schemaRegistrySubject: undefined,
      schemaRegistryVersion: undefined,
      schema: { fields: [] },
    })
    setSchemaLoaded(false)
    setSchemaFieldCount(0)
    setSelectedSubject('')
    setSelectedVersion('latest')
    setVersions([])
    setSchemaError(undefined)
  }, [topicIndex, topicsStore])

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
    autoResolveDismissed,
    autoResolutionAttempted,
    isResolvingFromEvent,
    fetchSubjects,
    selectSubject,
    fetchVersionsForSubject,
    selectVersion,
    resolveFromEvent,
    applyAutoResolved,
    dismissAutoResolved,
    clearAppliedSchema,
  }
}
