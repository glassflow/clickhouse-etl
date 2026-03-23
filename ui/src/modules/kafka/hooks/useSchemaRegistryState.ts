'use client'

import { useState, useCallback } from 'react'
import { useStore } from '@/src/store'

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
  fetchSubjects: () => Promise<void>
  selectSubject: (subject: string) => Promise<void>
  selectVersion: (version: string) => void
  loadSchema: () => Promise<void>
}

export function useSchemaRegistryState(topicName: string, topicIndex: number): SchemaRegistryStateHook {
  const { kafkaStore, topicsStore } = useStore()
  const { schemaRegistry } = kafkaStore

  const [subjects, setSubjects] = useState<string[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [versions, setVersions] = useState<Array<{ version: number | string; label: string }>>([])
  const [selectedVersion, setSelectedVersion] = useState('latest')
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false)
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [isLoadingSchema, setIsLoadingSchema] = useState(false)
  const [schemaError, setSchemaError] = useState<string | undefined>(undefined)
  const [schemaLoaded, setSchemaLoaded] = useState(false)
  const [schemaFieldCount, setSchemaFieldCount] = useState(0)

  const fetchSubjects = useCallback(async () => {
    if (!schemaRegistry?.url) return
    setIsLoadingSubjects(true)
    setSchemaError(undefined)
    try {
      const response = await fetch('/ui-api/kafka/schema-registry/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: schemaRegistry.url,
          apiKey: schemaRegistry.apiKey,
          apiSecret: schemaRegistry.apiSecret,
          topicName,
        }),
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
  }, [schemaRegistry, topicName])

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
          body: JSON.stringify({
            url: schemaRegistry.url,
            apiKey: schemaRegistry.apiKey,
            apiSecret: schemaRegistry.apiSecret,
            subject,
          }),
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
    [schemaRegistry],
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
        body: JSON.stringify({
          url: schemaRegistry.url,
          apiKey: schemaRegistry.apiKey,
          apiSecret: schemaRegistry.apiSecret,
          subject: selectedSubject,
          version: selectedVersion,
        }),
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
  }, [schemaRegistry, selectedSubject, selectedVersion, topicIndex, topicsStore])

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
    fetchSubjects,
    selectSubject,
    selectVersion,
    loadSchema,
  }
}
