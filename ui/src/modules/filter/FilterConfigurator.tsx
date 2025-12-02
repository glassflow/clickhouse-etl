'use client'

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { PlusIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { v4 as uuidv4 } from 'uuid'
import { StepKeys } from '@/src/config/constants'
import FormActions from '@/src/components/shared/FormActions'
import { FilterConditionRow } from './components/FilterConditionRow'
import { FilterCondition, FilterOperator } from '@/src/store/filter.store'
import {
  toExprString,
  validateFilterConfigLocally,
  getDefaultValueForType,
  getOperatorsForType,
  FilterConfigValidation,
} from './utils'
import { validateFilterExpression, FilterValidationField } from '@/src/api/pipeline-api'

export interface FilterConfiguratorProps {
  onCompleteStep: (stepName: string) => void
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
  onCompleteStandaloneEditing?: () => void
}

export function FilterConfigurator({
  onCompleteStep,
  readOnly = false,
  standalone = false,
  toggleEditMode,
  pipelineActionState,
  onCompleteStandaloneEditing,
}: FilterConfiguratorProps) {
  const { coreStore, filterStore, topicsStore } = useStore()

  // Get filter config from store
  const filterConfig = filterStore.filterConfig
  const backendValidation = filterStore.backendValidation

  // Get topic data for available fields
  const topic = topicsStore.getTopic(0) // Filter applies to the first topic (ingestor)
  const selectedEvent = topic?.selectedEvent
  // Get schema from the topic's selectedEvent or from the topic itself
  const eventSchema = (topic as any)?.schema?.fields || []

  // Extract available fields from schema or event
  const availableFields = useMemo((): Array<{ name: string; type: string }> => {
    if (eventSchema && eventSchema.length > 0) {
      return eventSchema.map((f: any) => ({
        name: f.name,
        type: f.type,
      }))
    }

    // Fallback: extract from selected event if available
    if (selectedEvent?.event) {
      const fields: Array<{ name: string; type: string }> = []
      const extractFields = (obj: any, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const fieldName = prefix ? `${prefix}.${key}` : key
          let fieldType = 'string'
          if (typeof value === 'number') {
            fieldType = Number.isInteger(value) ? 'int' : 'float64'
          } else if (typeof value === 'boolean') {
            fieldType = 'bool'
          } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            extractFields(value, fieldName)
            continue
          }
          fields.push({ name: fieldName, type: fieldType })
        }
      }
      extractFields(selectedEvent.event)
      return fields
    }

    return []
  }, [eventSchema, selectedEvent])

  // Local validation state
  const [localValidation, setLocalValidation] = useState<FilterConfigValidation>({
    isValid: true,
    conditionErrors: {},
    globalErrors: [],
  })

  // State for tracking save success in edit mode
  const [isSaveSuccess, setIsSaveSuccess] = useState(false)

  // Track previous config key to avoid infinite loops
  const prevConfigKeyRef = useRef<string>('')
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Create a stable key for the filter config - computed directly without useMemo
  // to avoid dependency on array references
  const filterConfigKey = JSON.stringify({
    enabled: filterConfig.enabled,
    combinator: filterConfig.combinator,
    conditions: filterConfig.conditions.map((c) => ({
      id: c.id,
      field: c.field,
      fieldType: c.fieldType,
      operator: c.operator,
      value: c.value,
    })),
  })

  // Debounced backend validation - only run when filterConfigKey actually changes
  useEffect(() => {
    // Skip if config hasn't actually changed (prevents infinite loops)
    if (filterConfigKey === prevConfigKeyRef.current) {
      return
    }
    prevConfigKeyRef.current = filterConfigKey

    // Clear any pending validation timeout
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current)
      validationTimeoutRef.current = null
    }

    if (!filterConfig.enabled || filterConfig.conditions.length === 0) {
      setLocalValidation({ isValid: true, conditionErrors: {}, globalErrors: [] })
      return
    }

    // First do local validation
    const localResult = validateFilterConfigLocally(filterConfig)
    setLocalValidation(localResult)

    if (!localResult.isValid) {
      return
    }

    // Generate expression and validate with backend
    const expression = toExprString(filterConfig)
    if (!expression) {
      return
    }

    filterStore.setExpressionString(expression)
    filterStore.setBackendValidation({ status: 'validating' })

    validationTimeoutRef.current = setTimeout(async () => {
      const fields: FilterValidationField[] = availableFields.map((f) => ({
        name: f.name,
        type: f.type,
      }))

      const result = await validateFilterExpression(expression, fields)
      filterStore.setBackendValidation({
        status: result.valid ? 'valid' : 'invalid',
        error: result.error,
      })
    }, 500) // 500ms debounce

    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
      }
    }
  }, [filterConfigKey]) // Only depend on the stringified key

  // Add new condition
  const handleAddCondition = useCallback(() => {
    // Don't set default operator/value until field is selected
    const newCondition: FilterCondition = {
      id: uuidv4(),
      field: '',
      fieldType: '',
      operator: '' as FilterOperator, // Will be set when field is selected
      value: '',
    }
    filterStore.addCondition(newCondition)
  }, [filterStore])

  // Update condition
  const handleUpdateCondition = useCallback(
    (id: string, updates: Partial<FilterCondition>) => {
      filterStore.updateCondition(id, updates)
    },
    [filterStore],
  )

  // Remove condition
  const handleRemoveCondition = useCallback(
    (id: string) => {
      filterStore.removeCondition(id)
    },
    [filterStore],
  )

  // Change combinator
  const handleCombinatorChange = useCallback(
    (value: string) => {
      filterStore.setCombinator(value as 'and' | 'or')
    },
    [filterStore],
  )

  // Skip transformation
  const handleSkip = useCallback(() => {
    filterStore.skipFilter()
    onCompleteStep(StepKeys.FILTER_CONFIGURATOR)
  }, [filterStore, onCompleteStep])

  // Save and continue
  const handleSave = useCallback(() => {
    // Validate locally
    const validation = validateFilterConfigLocally(filterConfig)
    setLocalValidation(validation)

    if (!validation.isValid) {
      return
    }

    // Check backend validation passed
    if (filterConfig.enabled && backendValidation.status !== 'valid') {
      return
    }

    // Generate final expression
    const expression = toExprString(filterConfig)
    filterStore.setExpressionString(expression)

    if (standalone && onCompleteStandaloneEditing) {
      setIsSaveSuccess(true)
      onCompleteStandaloneEditing()
    } else {
      onCompleteStep(StepKeys.FILTER_CONFIGURATOR)
    }
  }, [filterConfig, backendValidation, filterStore, standalone, onCompleteStandaloneEditing, onCompleteStep])

  // Determine if we can continue
  const canContinue = useMemo(() => {
    if (!filterConfig.enabled || filterConfig.conditions.length === 0) {
      return true // Can skip filter
    }
    return localValidation.isValid && backendValidation.status === 'valid'
  }, [filterConfig, localValidation, backendValidation])

  // Render validation status badge
  const renderValidationStatus = () => {
    if (!filterConfig.enabled || filterConfig.conditions.length === 0) {
      return null
    }

    if (backendValidation.status === 'validating') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          Validating...
        </div>
      )
    }

    if (backendValidation.status === 'valid') {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircleIcon className="w-4 h-4" />
          Valid expression
        </div>
      )
    }

    if (backendValidation.status === 'invalid') {
      return (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <XCircleIcon className="w-4 h-4" />
          {backendValidation.error || 'Invalid expression'}
        </div>
      )
    }

    return null
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Description */}
      <div className="text-sm text-content">
        {availableFields.length > 0
          ? "Define filter conditions to include only events that match your criteria. Events that don't match will be excluded from the pipeline."
          : 'Select a topic and wait for event data to load to configure filtering.'}
      </div>

      {/* Conditions */}
      {availableFields.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-lg font-medium text-content">Filter Conditions</Label>
            {filterConfig.conditions.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Combine with:</span>
                <Select value={filterConfig.combinator} onValueChange={handleCombinatorChange} disabled={readOnly}>
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="and">AND</SelectItem>
                    <SelectItem value="or">OR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Condition rows */}
          <div className="space-y-4">
            {filterConfig.conditions.map((condition, index) => (
              <FilterConditionRow
                key={condition.id}
                condition={condition}
                availableFields={availableFields}
                onChange={handleUpdateCondition}
                onRemove={handleRemoveCondition}
                validation={localValidation.conditionErrors[condition.id]}
                readOnly={readOnly}
                isFirst={index === 0}
              />
            ))}
          </div>

          {/* Add condition button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddCondition}
            disabled={readOnly}
            className="flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Add Filter
          </Button>

          {/* Generated expression preview */}
          {filterConfig.conditions.length > 0 && (
            <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-muted-foreground">Generated Expression</Label>
                {renderValidationStatus()}
              </div>
              <code className="block text-sm font-mono p-2 bg-background rounded border">
                {filterStore.expressionString || toExprString(filterConfig) || '(empty)'}
              </code>
            </div>
          )}

          {/* Global validation errors */}
          {localValidation.globalErrors.length > 0 && (
            <div className="text-sm text-red-500">
              {localValidation.globalErrors.map((error, i) => (
                <div key={i}>{error}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-4 items-center">
        {/* Skip button - only shown in creation mode (not standalone/edit mode) */}
        {!standalone && (
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)]"
          >
            Skip Transformation
          </Button>
        )}

        <FormActions
          standalone={standalone}
          onSubmit={handleSave}
          onDiscard={() => filterStore.resetFilterStore()}
          isLoading={false}
          isSuccess={isSaveSuccess}
          disabled={!canContinue}
          successText="Add Transformation"
          loadingText="Validating..."
          regularText="Add Transformation"
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

export default FilterConfigurator
