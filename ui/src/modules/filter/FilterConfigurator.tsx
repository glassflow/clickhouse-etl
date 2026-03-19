'use client'

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { Label } from '@/src/components/ui/label'
import { Textarea } from '@/src/components/ui/textarea'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { StepKeys } from '@/src/config/constants'
import FormActions from '@/src/components/shared/FormActions'
import { QueryGroup } from './components/QueryGroup'
import { FilterRule, FilterGroup } from '@/src/store/filter.store'
import {
  toExprString,
  validateFilterConfigLocally,
  FilterConfigValidation,
  countRulesInGroup,
  getAllRules,
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

  // Extract available fields from schema or event (use effective type: userType || type for overrides)
  const availableFields = useMemo((): Array<{ name: string; type: string }> => {
    if (eventSchema && eventSchema.length > 0) {
      return eventSchema
        .filter((f: any) => !f.isRemoved)
        .map((f: any) => ({
          name: f.name,
          type: f.userType || f.type || 'string',
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

  // Track which conditions have been touched (interacted with by user)
  const [touchedConditions, setTouchedConditions] = useState<Set<string>>(new Set())

  // Track if save has been attempted (to show all validation errors)
  const [saveAttempted, setSaveAttempted] = useState(false)

  // State for tracking save success in edit mode
  const [isSaveSuccess, setIsSaveSuccess] = useState(false)

  // Track previous config key to avoid infinite loops
  const prevConfigKeyRef = useRef<string>('')
  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Helper to serialize the filter tree for comparison
  const serializeGroup = (group: FilterGroup): any => ({
    id: group.id,
    combinator: group.combinator,
    not: group.not,
    children: group.children.map((child) => {
      if (child.type === 'rule') {
        return {
          type: 'rule',
          id: child.id,
          field: child.field,
          fieldType: child.fieldType,
          operator: child.operator,
          value: child.value,
          not: child.not,
          useArithmeticExpression: child.useArithmeticExpression,
          arithmeticExpression: child.arithmeticExpression,
        }
      } else {
        return serializeGroup(child)
      }
    }),
  })

  // Create a stable key for the filter config
  const filterConfigKey = JSON.stringify({
    enabled: filterConfig.enabled,
    root: filterConfig.root ? serializeGroup(filterConfig.root) : null,
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

    const totalRules = filterConfig.root ? countRulesInGroup(filterConfig.root) : 0

    if (!filterConfig.enabled || totalRules === 0) {
      setLocalValidation({ isValid: true, conditionErrors: {}, globalErrors: [] })
      return
    }

    // First do local validation
    const localResult = validateFilterConfigLocally(filterConfig)

    // Only show errors for touched conditions or if save was attempted
    const filteredErrors: Record<string, any> = {}
    for (const [id, errors] of Object.entries(localResult.conditionErrors)) {
      if (touchedConditions.has(id) || saveAttempted) {
        filteredErrors[id] = errors
      }
    }

    setLocalValidation({
      ...localResult,
      conditionErrors: filteredErrors,
    })

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
  }, [filterConfigKey, touchedConditions, saveAttempted])

  // Mark a condition as touched
  const handleTouched = useCallback((id: string) => {
    setTouchedConditions((prev) => new Set(prev).add(id))
  }, [])

  // Add new rule to a group
  const handleAddRule = useCallback(
    (parentGroupId: string) => {
      filterStore.addRule(parentGroupId)
    },
    [filterStore],
  )

  // Add new group to a parent group
  const handleAddGroup = useCallback(
    (parentGroupId: string) => {
      filterStore.addGroup(parentGroupId)
    },
    [filterStore],
  )

  // Update rule
  const handleUpdateRule = useCallback(
    (ruleId: string, updates: Partial<Omit<FilterRule, 'id' | 'type'>>) => {
      filterStore.updateRule(ruleId, updates)
    },
    [filterStore],
  )

  // Update group
  const handleUpdateGroup = useCallback(
    (groupId: string, updates: Partial<Pick<FilterGroup, 'combinator' | 'not'>>) => {
      filterStore.updateGroup(groupId, updates)
    },
    [filterStore],
  )

  // Remove item (rule or group)
  const handleRemoveItem = useCallback(
    (itemId: string) => {
      filterStore.removeItem(itemId)
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
    // Mark save as attempted to show all validation errors
    setSaveAttempted(true)

    // Mark all rules as touched
    if (filterConfig.root) {
      const allRules = getAllRules(filterConfig.root)
      setTouchedConditions(new Set(allRules.map((r) => r.id)))
    }

    // Validate locally
    const validation = validateFilterConfigLocally(filterConfig)
    setLocalValidation(validation)

    if (!validation.isValid) {
      return
    }

    // Check backend validation passed (only if filter has rules)
    const totalRules = filterConfig.root ? countRulesInGroup(filterConfig.root) : 0
    if (filterConfig.enabled && totalRules > 0 && backendValidation.status !== 'valid') {
      return
    }

    // Generate final expression
    const expression = toExprString(filterConfig)
    filterStore.setExpressionString(expression)

    if (standalone && onCompleteStandaloneEditing) {
      // CRITICAL: Mark configuration as dirty so it gets sent to backend on resume
      coreStore.markAsDirty()
      setIsSaveSuccess(true)
      onCompleteStandaloneEditing()
    } else {
      onCompleteStep(StepKeys.FILTER_CONFIGURATOR)
    }
  }, [filterConfig, backendValidation, filterStore, standalone, onCompleteStandaloneEditing, onCompleteStep, coreStore])

  // Determine if we can continue
  const canContinue = useMemo(() => {
    const totalRules = filterConfig.root ? countRulesInGroup(filterConfig.root) : 0
    if (!filterConfig.enabled || totalRules === 0) {
      return true // Can skip filter
    }
    return localValidation.isValid && backendValidation.status === 'valid'
  }, [filterConfig, localValidation, backendValidation])

  // Render validation status badge
  const renderValidationStatus = () => {
    const totalRules = filterConfig.root ? countRulesInGroup(filterConfig.root) : 0
    if (!filterConfig.enabled || totalRules === 0) {
      return null
    }

    if (backendValidation.status === 'validating') {
      return (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <div className="w-4 h-4 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full animate-spin" />
          Validating...
        </div>
      )
    }

    if (backendValidation.status === 'valid') {
      return (
        <div className="flex items-center gap-2 text-sm text-[var(--color-foreground-positive)]">
          <CheckCircleIcon className="w-4 h-4" />
          Valid expression
        </div>
      )
    }

    if (backendValidation.status === 'invalid') {
      return (
        <div className="flex items-center gap-2 text-sm text-[var(--color-foreground-critical)]">
          <XCircleIcon className="w-4 h-4" />
          {backendValidation.error || 'Invalid expression'}
        </div>
      )
    }

    return null
  }

  const totalRules = filterConfig.root ? countRulesInGroup(filterConfig.root) : 0

  // Check if we have a hydrated expression but no tree structure (view mode for existing filter)
  const hasHydratedExpression = filterConfig.enabled && filterStore.expressionString && totalRules === 0
  const hasNoFilter = !filterConfig.enabled && !filterStore.expressionString

  // Render the hydrated expression view (read-only mode for existing filter)
  const renderHydratedExpressionView = () => (
    <div className="space-y-4">
      <Label className="text-lg font-medium text-content">Current Filter Expression</Label>
      <div className="p-4 card-outline rounded-[var(--radius-xl)] space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-[var(--text-secondary)]">Filter Expression</Label>
          <div className="flex items-center gap-2 text-sm text-[var(--color-foreground-positive)]">
            <CheckCircleIcon className="w-4 h-4" />
            Active
          </div>
        </div>
        <Textarea
          readOnly
          value={filterStore.expressionString || ''}
          className="text-sm font-mono p-3 bg-[var(--surface-bg-sunken)] rounded-[var(--radius-md)] border border-[var(--surface-border)] text-[var(--text-primary)] resize-none cursor-default min-h-[60px] max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words"
          rows={3}
          wrap="soft"
        />
      </div>
      {!readOnly && (
        <div className="text-sm text-[var(--text-secondary)]">
          To modify this filter, you can rebuild the filter rules using the query builder below.
        </div>
      )}
    </div>
  )

  // Render the no filter view
  const renderNoFilterView = () => (
    <div className="space-y-4">
      <div className="p-6 card-outline rounded-[var(--radius-xl)] text-center">
        <div className="text-[var(--color-foreground-neutral-faded)] mb-2">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <p className="text-lg font-medium">No Filter Configured</p>
          <p className="text-sm mt-1">All events from the topic will be processed without filtering.</p>
        </div>
        {!readOnly && availableFields.length > 0 && (
          <p className="text-sm text-[var(--text-secondary)] mt-4">
            Click &quot;Edit&quot; to add filter conditions and only process events that match your criteria.
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Description */}
      <div className="text-sm text-content">
        {availableFields.length > 0
          ? "Define filter conditions to exclude events that match your criteria. Events that don't match will pass through the pipeline."
          : 'Select a topic and wait for event data to load to configure filtering.'}
      </div>

      {/* Show appropriate view based on state */}
      {hasNoFilter && readOnly && renderNoFilterView()}

      {/* Show hydrated expression in read-only mode */}
      {hasHydratedExpression && readOnly && renderHydratedExpressionView()}

      {/* Query Builder - show when we have fields and either: not read-only, or read-only with tree structure */}
      {availableFields.length > 0 && (!readOnly || totalRules > 0) && (
        <div className="space-y-4">
          <Label className="text-lg font-medium text-content">Filter Rules</Label>

          {/* Query Group (recursive) */}
          {filterConfig.root && (
            <QueryGroup
              group={filterConfig.root}
              availableFields={availableFields}
              onAddRule={handleAddRule}
              onAddGroup={handleAddGroup}
              onUpdateRule={handleUpdateRule}
              onUpdateGroup={handleUpdateGroup}
              onRemoveItem={handleRemoveItem}
              onTouched={handleTouched}
              conditionErrors={localValidation.conditionErrors}
              readOnly={readOnly}
              depth={0}
              isRoot={true}
            />
          )}

          {/* Generated expression preview */}
          {totalRules > 0 && (
            <div className="mt-6 p-4 card-outline rounded-[var(--radius-xl)] space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-[var(--text-secondary)]">Generated Expression</Label>
                {renderValidationStatus()}
              </div>
              <Textarea
                readOnly
                value={toExprString(filterConfig) || '(empty)'}
                className="text-sm font-mono p-3 bg-[var(--surface-bg-sunken)] rounded-[var(--radius-md)] border border-[var(--surface-border)] text-[var(--text-primary)] resize-none cursor-default min-h-[60px] max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words"
                rows={3}
                wrap="soft"
              />
            </div>
          )}

          {/* Global validation errors */}
          {localValidation.globalErrors.length > 0 && (
            <div className="text-sm text-[var(--color-foreground-critical)]">
              {localValidation.globalErrors.map((error, i) => (
                <div key={i}>{error}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Show no filter message in edit mode when no fields available */}
      {!readOnly && availableFields.length === 0 && hasNoFilter && (
        <div className="p-4 card-outline rounded-[var(--radius-xl)] text-center text-[var(--text-secondary)]">
          <p>Waiting for topic data to configure filtering...</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-4 items-center">
        <FormActions
          standalone={standalone}
          onSubmit={handleSave}
          onDiscard={() => filterStore.resetFilterStore()}
          isLoading={false}
          isSuccess={isSaveSuccess}
          disabled={!canContinue}
          successText="Save Filter"
          loadingText="Validating..."
          regularText="Save Filter"
          actionType="primary"
          showLoadingIcon={false}
          readOnly={readOnly}
          toggleEditMode={toggleEditMode}
          pipelineActionState={pipelineActionState}
          onClose={onCompleteStandaloneEditing}
        />

        {/* Skip button - only shown in creation mode (not standalone/edit mode) */}
        {!standalone && (
          <Button variant="tertiary" onClick={handleSkip}>
            Skip Filter
          </Button>
        )}
      </div>
    </div>
  )
}

export default FilterConfigurator
