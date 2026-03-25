'use client'

import { useState, useCallback } from 'react'
import { getPipelineForBinding } from '@/src/api/pipeline-api'
import type { SchemaRegistryFormType } from '@/src/scheme/kafka.scheme'

export interface SchemaBinding {
  topicName: string
  version: string
  isCurrent: boolean
}

/**
 * Discovers all schema bindings for a pipeline by probing the backend.
 *
 * For each topic that uses an external schema registry:
 * 1. Fetches all subjects from the registry
 * 2. For each subject, fetches all available versions
 * 3. For each unique version, probes GET /pipeline/:id?topic=X&schema=V
 * 4. Successful probes indicate an existing binding
 *
 * Bindings are grouped by topic name. The version matching the pipeline's
 * current schema_version for that topic is marked isCurrent: true.
 */
export function useSchemaBindings(
  pipelineId: string,
  pipeline: any,
  schemaRegistry: SchemaRegistryFormType | undefined,
) {
  const [bindingsPerTopic, setBindingsPerTopic] = useState<Record<string, SchemaBinding[]>>({})
  const [isLoading, setIsLoading] = useState(false)

  const discover = useCallback(async () => {
    if (!pipelineId || !pipeline?.source?.topics?.length) return
    if (!schemaRegistry?.url) return

    setIsLoading(true)

    try {
      const authBody = {
        url: schemaRegistry.url,
        authMethod: schemaRegistry.authMethod,
        apiKey: schemaRegistry.apiKey,
        apiSecret: schemaRegistry.apiSecret,
        username: schemaRegistry.username,
        password: schemaRegistry.password,
      }

      // Fetch all subjects from registry once
      let allSubjects: string[] = []
      try {
        const subjectsRes = await fetch('/ui-api/kafka/schema-registry/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...authBody }),
        })
        const subjectsData = await subjectsRes.json()
        if (subjectsData.success) {
          allSubjects = subjectsData.subjects || []
        }
      } catch {
        // Registry unreachable — skip discovery
        return
      }

      if (allSubjects.length === 0) return

      // For each topic that uses external schema, discover its bindings
      const result: Record<string, SchemaBinding[]> = {}

      await Promise.all(
        pipeline.source.topics.map(async (topicConfig: any) => {
          const topicName: string = topicConfig.name
          // schema_version may come from the backend per-topic field; fall back to empty string
          // (isCurrent matching is best-effort — the backend may not return this field)
          const currentVersion: string = topicConfig.schema_version ?? ''

          // Filter subjects relevant to this topic (match by topic name prefix)
          const relevantSubjects = allSubjects.filter(
            (s) =>
              s === topicName ||
              s === `${topicName}-value` ||
              s === `${topicName}-key` ||
              s.startsWith(`${topicName}-`) ||
              s.startsWith(topicName),
          )
          const subjectsToCheck = relevantSubjects.length > 0 ? relevantSubjects : allSubjects

          // Collect all versions across relevant subjects (deduplicated)
          const versionSet = new Set<string>()
          await Promise.all(
            subjectsToCheck.map(async (subject) => {
              try {
                const versionsRes = await fetch('/ui-api/kafka/schema-registry/versions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...authBody, subject }),
                })
                const versionsData = await versionsRes.json()
                if (versionsData.success && Array.isArray(versionsData.versions)) {
                  versionsData.versions.forEach((v: { version: number | string }) => {
                    versionSet.add(String(v.version))
                  })
                }
              } catch {
                // skip unreachable subject
              }
            }),
          )

          if (versionSet.size === 0) return

          // Probe each version against the backend pipeline config
          const probeResults = await Promise.allSettled(
            Array.from(versionSet).map(async (version) => {
              const config = await getPipelineForBinding(pipelineId, topicName, version)
              if (!config) return null
              return version
            }),
          )

          const existingVersions: string[] = probeResults
            .filter((r) => r.status === 'fulfilled' && r.value !== null)
            .map((r) => (r as PromiseFulfilledResult<string>).value)

          if (existingVersions.length === 0) return

          // Sort descending numerically, fallback to string sort
          existingVersions.sort((a, b) => {
            const na = parseInt(a, 10)
            const nb = parseInt(b, 10)
            if (!isNaN(na) && !isNaN(nb)) return nb - na
            return b.localeCompare(a)
          })

          result[topicName] = existingVersions.map((version) => ({
            topicName,
            version,
            isCurrent: version === currentVersion,
          }))
        }),
      )

      setBindingsPerTopic(result)
    } finally {
      setIsLoading(false)
    }
  }, [pipelineId, pipeline, schemaRegistry])

  return { bindingsPerTopic, isLoading, discover }
}
