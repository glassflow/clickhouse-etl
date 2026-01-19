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
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline'

// Type for a field with its inferred and user-overridden type
interface FieldTypeInfo {
  name: string
  inferredType: string
  userType: string // User-overridden type (or same as inferred if not changed)
  isManuallyAdded: boolean // true for user-added fields
  isRemoved: boolean // true for fields marked for removal
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

  // State for adding new fields
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState('string')
  const [newFieldError, setNewFieldError] = useState<string | null>(null)

  // Extract fields and infer types when event data changes
  useEffect(() => {
    if (!eventData) {
      setFieldTypes([])
      return
    }

    // Get existing schema if available (from hydration or previous session)
    const existingSchema = (topic as any)?.schema?.fields || []
    const existingSchemaMap = new Map<string, any>(existingSchema.map((f: any) => [f.name, f]))

    // Extract all fields from the event
    const inferredFields = extractEventFields(eventData)

    // Create field type info for each inferred field
    const inferredTypeInfo: FieldTypeInfo[] = inferredFields.map((fieldName) => {
      // Get nested value for type inference
      const value = getNestedValue(eventData, fieldName)
      const inferredType = inferJsonType(value) || 'string'

      // Check if this field exists in existing schema
      const existingField = existingSchemaMap.get(fieldName)
      const userType = existingField?.userType || existingField?.type || inferredType

      return {
        name: fieldName,
        inferredType,
        userType,
        isManuallyAdded: false,
        isRemoved: existingField?.isRemoved || false,
      }
    })

    // Add manually added fields from existing schema that aren't in inferred fields
    const manuallyAddedFields: FieldTypeInfo[] = existingSchema
      .filter((f: any) => f.isManuallyAdded && !inferredFields.includes(f.name))
      .map((f: any) => ({
        name: f.name,
        inferredType: '-', // No inferred type for manually added fields
        userType: f.userType || f.type || 'string',
        isManuallyAdded: true,
        isRemoved: f.isRemoved || false,
      }))

    setFieldTypes([...inferredTypeInfo, ...manuallyAddedFields])
  }, [eventData, topic])

  // Helper to get nested value from object
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  // Handle type change for a specific field
  const handleTypeChange = useCallback((fieldName: string, newType: string) => {
    setFieldTypes((prev) => prev.map((field) => (field.name === fieldName ? { ...field, userType: newType } : field)))
  }, [])

  // Validate new field name
  const validateFieldName = useCallback(
    (name: string): string | null => {
      const trimmedName = name.trim()
      if (!trimmedName) {
        return 'Field name cannot be empty'
      }
      // Check for duplicates (case-sensitive, among non-removed fields)
      const existingNames = fieldTypes.filter((f) => !f.isRemoved).map((f) => f.name)
      if (existingNames.includes(trimmedName)) {
        return 'A field with this name already exists'
      }
      // Validate field name format (alphanumeric, underscores, dots for nested paths)
      if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(trimmedName)) {
        return 'Field name must start with a letter or underscore and contain only letters, numbers, underscores, or dots'
      }
      return null
    },
    [fieldTypes],
  )

  // Handle adding a new field
  const handleAddField = useCallback(() => {
    const error = validateFieldName(newFieldName)
    if (error) {
      setNewFieldError(error)
      return
    }

    const newField: FieldTypeInfo = {
      name: newFieldName.trim(),
      inferredType: '-', // No inferred type for manually added fields
      userType: newFieldType,
      isManuallyAdded: true,
      isRemoved: false,
    }

    setFieldTypes((prev) => [...prev, newField])
    setNewFieldName('')
    setNewFieldType('string')
    setNewFieldError(null)
  }, [newFieldName, newFieldType, validateFieldName])

  // Handle removing a field
  const handleRemoveField = useCallback((fieldName: string) => {
    setFieldTypes((prev) =>
      prev
        .map((field) => {
          if (field.name !== fieldName) return field
          // If manually added, remove completely; otherwise mark as removed
          if (field.isManuallyAdded) {
            return null as any // Will be filtered out
          }
          return { ...field, isRemoved: true }
        })
        .filter(Boolean),
    )
  }, [])

  // Handle restoring a removed field
  const handleRestoreField = useCallback((fieldName: string) => {
    setFieldTypes((prev) => prev.map((field) => (field.name === fieldName ? { ...field, isRemoved: false } : field)))
  }, [])

  // Handle save/continue
  const handleSave = useCallback(() => {
    if (!topic?.name) return

    // Store ALL field types in the topic's schema, including removed fields
    // This preserves the removed state when user navigates back to this step
    // Downstream steps (transformation, mapping) will filter out removed fields
    const schema = {
      fields: fieldTypes.map((f) => ({
        name: f.name,
        type: f.userType,
        inferredType: f.inferredType,
        userType: f.userType,
        isManuallyAdded: f.isManuallyAdded,
        isRemoved: f.isRemoved,
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

  // Check if we can continue (must have at least one active field)
  const activeFieldCount = fieldTypes.filter((f) => !f.isRemoved).length
  const canContinue = activeFieldCount > 0

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
      <div className="text-content-faded text-sm">
        Review and customize the schema for your Kafka events. You can verify inferred types, add new fields, or remove
        fields you don&apos;t need. This schema will be used for transformations and mapping to ClickHouse.
      </div>

      <div className="flex gap-4 w-full">
        {/* Field Types Table */}
        <div className="flex-[2] min-w-0">
          <Label className="text-lg font-medium text-content mb-4 block">Field Types</Label>

          <div className="p-6 rounded-[var(--radius-large)] overflow-hidden">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-0">
                  <TableHead className="text-content font-medium py-3 px-4 w-[40%]">Field Name</TableHead>
                  <TableHead className="text-content font-medium py-3 px-4 w-[20%]">Inferred Type</TableHead>
                  <TableHead className="text-content font-medium py-3 px-4 w-[25%]">Data Type</TableHead>
                  {!readOnly && (
                    <TableHead className="text-content font-medium py-3 px-4 w-[15%] text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fieldTypes.map((field) => (
                  <TableRow
                    key={field.name}
                    className={`border-0 ${field.isRemoved ? 'opacity-50' : ''} ${
                      field.isManuallyAdded && !field.isRemoved
                        ? 'bg-[var(--color-background-primary-faded)]'
                        : 'bg-[var(--surface-bg-sunken)]'
                    } ${!readOnly && !field.isRemoved ? 'hover:bg-[var(--color-background-neutral-faded)]' : ''}`}
                    style={{
                      transition: 'background-color 0.2s ease-in-out, opacity 0.2s ease-in-out',
                    }}
                  >
                    <TableCell
                      className={`py-3 px-4 font-mono text-sm text-content ${field.isRemoved ? 'line-through' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        {field.name}
                        {field.isManuallyAdded && !field.isRemoved && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-background-primary-faded)] text-[var(--color-foreground-primary)]">
                            Added
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell
                      className={`py-3 px-4 text-sm text-[var(--text-secondary)] ${field.isRemoved ? 'line-through' : ''}`}
                    >
                      {field.inferredType}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <Select
                        value={field.userType}
                        onValueChange={(value) => handleTypeChange(field.name, value)}
                        disabled={readOnly || field.isRemoved}
                      >
                        <SelectTrigger
                          className={`w-full input-regular input-border-regular ${
                            field.userType !== field.inferredType && field.inferredType !== '-'
                              ? 'border-[var(--color-border-primary)]'
                              : ''
                          } ${readOnly || field.isRemoved ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    {!readOnly && (
                      <TableCell className="py-3 px-4 text-right">
                        {field.isRemoved ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestoreField(field.name)}
                            className="text-[var(--color-foreground-primary)] hover:text-[var(--color-foreground-primary)] hover:bg-[var(--color-background-primary-faded)]"
                            title="Restore field"
                          >
                            Restore
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveField(field.name)}
                            className="text-[var(--color-foreground-negative)] hover:text-[var(--color-foreground-negative)] hover:bg-[var(--color-background-negative-faded)]"
                            title="Remove field"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}

                {/* Add new field row */}
                {!readOnly && (
                  <TableRow className="border-0 bg-[var(--surface-bg-sunken)]">
                    <TableCell className="py-3 px-4">
                      <Input
                        value={newFieldName}
                        onChange={(e) => {
                          setNewFieldName(e.target.value)
                          if (newFieldError) setNewFieldError(null)
                        }}
                        placeholder="Enter field name..."
                        className={`input-regular input-border-regular font-mono text-sm ${
                          newFieldError ? 'border-[var(--color-border-negative)]' : ''
                        }`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newFieldName.trim()) {
                            handleAddField()
                          }
                        }}
                      />
                      {newFieldError && (
                        <div className="text-xs text-[var(--color-foreground-negative)] mt-1">{newFieldError}</div>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-sm text-[var(--text-secondary)]">-</TableCell>
                    <TableCell className="py-3 px-4">
                      <Select value={newFieldType} onValueChange={setNewFieldType}>
                        <SelectTrigger className="w-full input-regular input-border-regular">
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
                    <TableCell className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleAddField}
                        disabled={!newFieldName.trim()}
                        className="text-[var(--color-foreground-primary)] hover:text-[var(--color-foreground-primary)] hover:bg-[var(--color-background-primary-faded)] disabled:opacity-50"
                        title="Add field"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Status messages */}
          <div className="mt-3 flex flex-col gap-1">
            {fieldTypes.some((f) => f.userType !== f.inferredType && f.inferredType !== '-' && !f.isRemoved) && (
              <div className="text-sm text-[var(--color-foreground-primary)]">
                Some types have been modified from their inferred values.
              </div>
            )}
            {fieldTypes.some((f) => f.isManuallyAdded && !f.isRemoved) && (
              <div className="text-sm text-[var(--color-foreground-primary)]">
                {fieldTypes.filter((f) => f.isManuallyAdded && !f.isRemoved).length} custom field(s) added.
              </div>
            )}
            {fieldTypes.some((f) => f.isRemoved) && (
              <div className="text-sm text-[var(--color-foreground-negative)]">
                {fieldTypes.filter((f) => f.isRemoved).length} field(s) marked for removal.
              </div>
            )}
          </div>
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
