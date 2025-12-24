'use client'

import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { useStore } from '@/src/store'
import { EventEditor } from '@/src/components/shared/EventEditor'
import { parseForCodeEditor, extractEventFields } from '@/src/utils/common.client'
import { inferJsonType } from '@/src/modules/clickhouse/utils'
import { StepKeys, JSON_DATA_TYPES } from '@/src/config/constants'
import FormActions from '@/src/components/shared/FormActions'
import { useValidationEngine } from '@/src/store/state-machine/validation-engine'
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from '@/src/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/src/components/ui/select'
import { Label } from '@/src/components/ui/label'

// Type for a field with its inferred and user-overridden type
interface FieldTypeInfo {
  name: string
  inferredType: string
  userType: string // User-overridden type (or same as inferred if not changed)
}

export interface KafkaTypeVerificationProps {
  onCompleteStep: (stepName: string) => void
  index?: number
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
  onCompleteStandaloneEditing?: () => void
}

export function KafkaTypeVerification({
  onCompleteStep,
  index = 0,
  readOnly = false,
  standalone = false,
  toggleEditMode,
  pipelineActionState,
  onCompleteStandaloneEditing,
}: KafkaTypeVerificationProps) {
  const validationEngine = useValidationEngine()
  const { coreStore, topicsStore } = useStore()

  // Get topic data
  const topic = topicsStore.getTopic(index)
  const selectedEvent = topic?.selectedEvent
  const eventData = selectedEvent?.event || null

  // State for field types - managed locally, will be stored in topic schema
  const [fieldTypes, setFieldTypes] = useState<FieldTypeInfo[]>([])
  const [isSaveSuccess, setIsSaveSuccess] = useState(false)

  // Extract fields and infer types when event data changes
  useEffect(() => {
    if (!eventData) {
      setFieldTypes([])
      return
    }

    // Get existing schema if available (from hydration or previous session)
    const existingSchema = (topic as any)?.schema?.fields || []
    const existingTypeMap = new Map<string, string>(existingSchema.map((f: any) => [f.name, f.userType || f.type]))

    // Extract all fields from the event
    const fields = extractEventFields(eventData)

    // Create field type info for each field
    const typeInfo: FieldTypeInfo[] = fields.map((fieldName) => {
      // Get nested value for type inference
      const value = getNestedValue(eventData, fieldName)
      const inferredType = inferJsonType(value) || 'string'

      // Use existing user type if available, otherwise use inferred type
      const userType = existingTypeMap.get(fieldName) || inferredType

      return {
        name: fieldName,
        inferredType,
        userType,
      }
    })

    setFieldTypes(typeInfo)
  }, [eventData, topic])

  // Helper to get nested value from object
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  // Handle type change for a specific field
  const handleTypeChange = useCallback((fieldName: string, newType: string) => {
    setFieldTypes((prev) => prev.map((field) => (field.name === fieldName ? { ...field, userType: newType } : field)))
  }, [])

  // Handle save/continue
  const handleSave = useCallback(() => {
    if (!topic?.name) return

    // Store the verified field types in the topic's schema
    // This will be used by downstream steps (transformation, mapping)
    const schema = {
      fields: fieldTypes.map((f) => ({
        name: f.name,
        type: f.userType,
        inferredType: f.inferredType,
        userType: f.userType,
      })),
    }

    // Update the topic with the schema
    topicsStore.updateTopic({
      ...topic,
      schema,
    })

    // Mark this section as valid
    validationEngine.onSectionConfigured(StepKeys.KAFKA_TYPE_VERIFICATION)

    if (standalone && toggleEditMode) {
      coreStore.markAsDirty()
      setIsSaveSuccess(true)
      onCompleteStandaloneEditing?.()
    } else {
      onCompleteStep(StepKeys.KAFKA_TYPE_VERIFICATION)
    }
  }, [
    topic,
    fieldTypes,
    topicsStore,
    validationEngine,
    standalone,
    toggleEditMode,
    coreStore,
    onCompleteStandaloneEditing,
    onCompleteStep,
  ])

  // Handle discard changes
  const handleDiscardChanges = useCallback(() => {
    coreStore.discardSection('topics')
  }, [coreStore])

  // Reset success state when editing
  useEffect(() => {
    if (!readOnly && isSaveSuccess) {
      setIsSaveSuccess(false)
    }
  }, [readOnly, isSaveSuccess])

  // Check if we can continue (always true as long as we have fields)
  const canContinue = fieldTypes.length > 0

  // Show error if no topic data
  if (!topic) {
    return <div className="text-[var(--text-secondary)]">No topic data available. Please select a topic first.</div>
  }

  if (!eventData) {
    return (
      <div className="text-[var(--text-secondary)]">
        No event data available for topic &quot;{topic.name}&quot;. Please ensure the topic has events.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Description */}
      <div className="text-sm text-content">
        Review and verify the data types for each field in your Kafka events. You can override the inferred types if
        needed. These types will be used for transformations and mapping to ClickHouse.
      </div>

      <div className="flex gap-4 w-full">
        {/* Field Types Table */}
        <div className="flex-[2] min-w-0">
          <Label className="text-lg font-medium text-content mb-4 block">Field Types</Label>

          <div className="card-outline rounded-[var(--radius-large)] overflow-hidden">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-b border-[var(--surface-border)]">
                  <TableHead className="text-content font-medium py-3 px-4 w-[50%]">Field Name</TableHead>
                  <TableHead className="text-content font-medium py-3 px-4 w-[25%]">Inferred Type</TableHead>
                  <TableHead className="text-content font-medium py-3 px-4 w-[25%]">Data Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fieldTypes.map((field) => (
                  <TableRow key={field.name} className="border-b border-[var(--surface-border)] last:border-b-0">
                    <TableCell className="py-3 px-4 font-mono text-sm text-content">{field.name}</TableCell>
                    <TableCell className="py-3 px-4 text-sm text-[var(--text-secondary)]">
                      {field.inferredType}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <Select
                        value={field.userType}
                        onValueChange={(value) => handleTypeChange(field.name, value)}
                        disabled={readOnly}
                      >
                        <SelectTrigger
                          className={`w-full input-regular input-border-regular ${
                            field.userType !== field.inferredType ? 'border-[var(--color-border-primary)]' : ''
                          } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="select-content-custom">
                          {JSON_DATA_TYPES.map((type) => (
                            <SelectItem key={type} value={type} className="select-item-custom">
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {fieldTypes.some((f) => f.userType !== f.inferredType) && (
            <div className="mt-3 text-sm text-[var(--color-foreground-primary)]">
              Some types have been modified from their inferred values.
            </div>
          )}
        </div>

        {/* Event Preview */}
        {/* <div className="flex-[3] min-w-0 min-h-[400px]">
          <EventEditor
            event={parseForCodeEditor(eventData)}
            topic={topic?.name}
            isLoadingEvent={false}
            eventError={''}
            isEmptyTopic={false}
            onManualEventChange={() => {}}
            isEditingEnabled={false}
            readOnly={true}
          />
        </div> */}
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 items-center">
        <FormActions
          standalone={standalone}
          onSubmit={handleSave}
          onDiscard={handleDiscardChanges}
          isLoading={false}
          isSuccess={isSaveSuccess}
          disabled={!canContinue}
          successText="Continue"
          loadingText="Saving..."
          regularText="Confirm Types"
          actionType="primary"
          showLoadingIcon={false}
          readOnly={readOnly}
          toggleEditMode={toggleEditMode}
          pipelineActionState={pipelineActionState}
          onClose={onCompleteStandaloneEditing}
        />
      </div>
    </div>
  )
}

export default KafkaTypeVerification
