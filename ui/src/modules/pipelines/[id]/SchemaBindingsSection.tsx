'use client'

import React, { useEffect, useImperativeHandle, forwardRef, useState } from 'react'
import { Card } from '@/src/components/ui/card'
import { cn } from '@/src/utils/common.client'
import { useStore } from '@/src/store'
import { useSchemaBindings, SchemaBinding } from '@/src/hooks/useSchemaBindings'
import { hydrateFromSchemaBinding } from '@/src/store/hydration/schema-binding'
import { getPipelineForBinding } from '@/src/api/pipeline-api'
import { structuredLogger } from '@/src/observability'
import type { SchemaRegistryFormType } from '@/src/scheme/kafka.scheme'

export interface SchemaBindingsSectionHandle {
  refresh: () => void
}

interface SchemaBindingsSectionProps {
  pipelineId: string
  pipeline: any
  schemaRegistry: SchemaRegistryFormType | undefined
}

/**
 * Displays all discovered schema bindings for the pipeline, grouped by topic.
 *
 * The current/last binding is highlighted as "active". Selecting a historical
 * binding loads its configuration into the store for viewing or editing.
 * Leaving a historical binding without saving restores the pipeline's current config.
 */
const SchemaBindingsSection = forwardRef<SchemaBindingsSectionHandle, SchemaBindingsSectionProps>(
  function SchemaBindingsSection({ pipelineId, pipeline, schemaRegistry }, ref) {
    const { coreStore } = useStore()
    const { bindingsPerTopic, isLoading, discover } = useSchemaBindings(pipelineId, pipeline, schemaRegistry)
    const [loadingVersion, setLoadingVersion] = useState<string | null>(null)

    // Expose refresh() to parent via ref
    useImperativeHandle(ref, () => ({ refresh: discover }), [discover])

    // Run discovery on mount
    useEffect(() => {
      discover()
    }, [discover])

    const selectedBindingVersions = useStore((s) => s.coreStore.selectedBindingVersions)
    const isViewingHistorical = coreStore.isViewingHistoricalBinding()

    const topicNames = Object.keys(bindingsPerTopic)

    // Don't render anything until discovery has run and found no bindings at all
    if (!isLoading && topicNames.length === 0) {
      return null
    }

    const handleSelectBinding = async (binding: SchemaBinding) => {
      if (loadingVersion) return

      if (binding.isCurrent && !selectedBindingVersions[binding.topicName]) {
        // Already on current — nothing to do
        return
      }

      if (binding.isCurrent) {
        // Return to current binding: re-hydrate from the original pipeline prop
        coreStore.resetBindingSelection()
        try {
          await coreStore.enterViewMode(pipeline)
        } catch (error) {
          structuredLogger.error('SchemaBindingsSection failed to restore current binding', {
            error: error instanceof Error ? error.message : String(error),
          })
        }
        return
      }

      // Load the historical binding
      const schemaParam = `${binding.subject}:${binding.version}`
      setLoadingVersion(schemaParam)
      try {
        const config = await getPipelineForBinding(pipelineId, binding.topicName, schemaParam)
        if (!config) {
          structuredLogger.warn('SchemaBindingsSection binding config not found', {
            topic: binding.topicName,
            version: schemaParam,
          })
          return
        }
        await hydrateFromSchemaBinding(config)
        coreStore.setSelectedBindingVersion(binding.topicName, schemaParam)
      } catch (error) {
        structuredLogger.error('SchemaBindingsSection failed to load binding', {
          topic: binding.topicName,
          version: binding.version,
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        setLoadingVersion(null)
      }
    }

    return (
      <div className="flex flex-col gap-3">
        {/* Historical binding banner */}
        {isViewingHistorical && (
          <div className="flex items-center gap-2 rounded-md border border-[var(--color-border-warning)] bg-[var(--color-bg-warning-faded,hsl(var(--warning)/0.08))] px-4 py-2 text-sm text-[var(--color-foreground-warning,hsl(var(--warning)))]">
            <span className="font-medium">Viewing a historical schema configuration.</span>
            <span className="text-content-faded">
              Changes to this configuration will be deployed as a variation of this pipeline.
            </span>
            <button
              className="ml-auto text-xs underline underline-offset-2 hover:opacity-80"
              onClick={() => {
                coreStore.resetBindingSelection()
                coreStore.enterViewMode(pipeline).catch(() => {})
              }}
            >
              Return to active
            </button>
          </div>
        )}

        <Card className="p-4">
          <div className="flex flex-col gap-4">
            <span className="text-sm font-semibold text-[var(--color-foreground-neutral-faded)]">
              Schema Bindings
            </span>

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-content-faded">
                <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full inline-block" />
                Discovering schema bindings...
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {topicNames.map((topicName) => {
                  const bindings = bindingsPerTopic[topicName] ?? []
                  if (bindings.length === 0) return null
                  const selectedVersion = selectedBindingVersions[topicName]

                  return (
                    <div key={topicName} className="flex flex-col gap-2">
                      {topicNames.length > 1 && (
                        <span className="text-xs font-medium text-content-faded uppercase tracking-wide">
                          Topic: {topicName}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {bindings.map((binding) => {
                          const bindingId = `${binding.subject}:${binding.version}`
                          const isSelected = selectedVersion
                            ? selectedVersion === bindingId
                            : binding.isCurrent
                          const isThisLoading = loadingVersion === bindingId

                          return (
                            <button
                              key={bindingId}
                              disabled={!!loadingVersion}
                              onClick={() => handleSelectBinding(binding)}
                              className={cn(
                                'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors',
                                isSelected
                                  ? 'border-[var(--color-border-primary)] bg-[var(--color-bg-primary-faded,hsl(var(--primary)/0.08))] text-[var(--color-foreground-primary,hsl(var(--primary)))] font-medium'
                                  : 'border-border bg-background text-content hover:border-[var(--color-border-primary)] hover:bg-[var(--color-bg-primary-faded,hsl(var(--primary)/0.04))]',
                                loadingVersion && loadingVersion !== bindingId && 'opacity-50 cursor-not-allowed',
                              )}
                            >
                              {isThisLoading ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : (
                                <span
                                  className={cn(
                                    'h-2 w-2 rounded-full',
                                    binding.isCurrent ? 'bg-green-500' : 'bg-[var(--color-border-neutral)]',
                                  )}
                                />
                              )}
                              Version {binding.version}
                              {binding.isCurrent && (
                                <span className="ml-1 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-green-500/10 text-green-600">
                                  active
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    )
  },
)

export default SchemaBindingsSection
