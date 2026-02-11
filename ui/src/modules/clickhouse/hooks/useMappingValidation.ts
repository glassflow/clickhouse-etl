import { useState, useEffect, useCallback } from 'react'
import { TableColumn, TableSchema, MappingMode, ValidationResult, ValidationIssues } from '../types'
import { validateColumnMappings, hasDefaultExpression } from '../utils'

interface UseMappingValidationParams {
  tableSchema: TableSchema
  mappedColumns: TableColumn[]
  eventFields: string[]
  primaryEventFields: string[]
  secondaryEventFields: string[]
  mode: MappingMode
}

interface UseMappingValidationReturn {
  validationIssues: ValidationIssues
  validateMapping: () => ValidationResult | null
}

/**
 * Custom hook for managing mapping validation state and logic.
 *
 * This hook:
 * 1. Continuously computes validation issues based on schema, mappings, and event fields
 * 2. Provides a validateMapping function that returns a ValidationResult for modal display
 *
 * The validation runs in real-time via useEffect so the UI can show immediate feedback.
 * The validateMapping callback converts issues to a modal-friendly ValidationResult.
 */
export function useMappingValidation({
  tableSchema,
  mappedColumns,
  eventFields,
  primaryEventFields,
  secondaryEventFields,
  mode,
}: UseMappingValidationParams): UseMappingValidationReturn {
  // Validation issues state - updated continuously as mappings change
  const [validationIssues, setValidationIssues] = useState<ValidationIssues>({
    unmappedNullableColumns: [],
    unmappedNonNullableColumns: [],
    unmappedDefaultColumns: [],
    extraEventFields: [],
    incompatibleTypeMappings: [],
    missingTypeMappings: [],
  })

  // Continuously validate mappings to update validation issues in real-time
  useEffect(() => {
    if (tableSchema.columns.length === 0 || mappedColumns.length === 0) {
      return
    }

    // Build validation state
    const issues: ValidationIssues = {
      unmappedNullableColumns: [],
      unmappedNonNullableColumns: [],
      unmappedDefaultColumns: [],
      extraEventFields: [],
      incompatibleTypeMappings: [],
      missingTypeMappings: [],
    }

    // Find unmapped columns
    tableSchema.columns.forEach((column) => {
      const mappedColumn = mappedColumns.find((mc) => mc.name === column.name)
      if (!mappedColumn || !mappedColumn.eventField) {
        // Check if the column is actually nullable by examining its type
        const isActuallyNullable = column?.type?.includes('Nullable') || column.isNullable === true

        // Check if the column has a DEFAULT expression
        const columnHasDefault = hasDefaultExpression(column)

        if (columnHasDefault) {
          // Column has DEFAULT - this is just a warning, not an error
          issues.unmappedDefaultColumns.push(column.name)
        } else if (isActuallyNullable) {
          // Column is nullable - safe to omit
          issues.unmappedNullableColumns.push(column.name)
        } else {
          // Column is non-nullable and has no default - this is an error
          issues.unmappedNonNullableColumns.push(column.name)
        }
      }
    })

    // Find extra event fields (fields not mapped to any column)
    const allEventFields = mode === 'single' ? eventFields : [...primaryEventFields, ...secondaryEventFields]
    const extraFields = allEventFields.filter((field) => !mappedColumns.some((col) => col.eventField === field))
    issues.extraEventFields = extraFields

    // Validate type compatibility
    const { invalidMappings, missingTypeMappings } = validateColumnMappings(mappedColumns)
    issues.incompatibleTypeMappings = invalidMappings
    issues.missingTypeMappings = missingTypeMappings

    setValidationIssues(issues)
  }, [tableSchema.columns, mappedColumns, eventFields, primaryEventFields, secondaryEventFields, mode])

  /**
   * Convert validation issues to a ValidationResult for modal display.
   * Returns null if there are no issues that require user attention.
   *
   * Priority order:
   * 1. Type compatibility violations (error - blocks)
   * 2. Missing type mappings (error - blocks)
   * 3. Non-nullable column violations (error - blocks)
   * 4. Unmapped DEFAULT columns (warning - can proceed)
   * 5. Unmapped nullable columns (warning - can proceed)
   * 6. Extra event fields (warning - can proceed)
   */
  const validateMapping = useCallback((): ValidationResult | null => {
    const issues = validationIssues

    // Count mapped fields for mismatch warning
    const mappedFieldsCount = mappedColumns.filter((col) => col.eventField).length
    const totalColumnsCount = tableSchema.columns.length

    // 1. Type compatibility violations (error)
    if (issues.incompatibleTypeMappings.length > 0) {
      const incompatibleFields = issues.incompatibleTypeMappings
        .map((mapping) => `${mapping.name} (${mapping.jsonType} → ${mapping.type})`)
        .join(', ')

      return {
        type: 'error',
        canProceed: false,
        title: 'Error: Type Incompatibility',
        message: `Some event fields are mapped to incompatible ClickHouse column types. Please review and fix these mappings:
        ${incompatibleFields}`,
        okButtonText: 'OK',
        cancelButtonText: 'Cancel',
      }
    }

    // 2. Missing type mappings (error)
    if (issues.missingTypeMappings.length > 0) {
      const missingTypeFields = issues.missingTypeMappings
        .map((mapping) => `${mapping.name} (mapped to ${mapping.eventField})`)
        .join(', ')

      return {
        type: 'error',
        canProceed: false,
        title: 'Error: Missing Type Information',
        message: `Some mapped fields have no type information. This might happen when the field path exists but the value is undefined or null. Please review these mappings:
        ${missingTypeFields}`,
        okButtonText: 'OK',
        cancelButtonText: 'Cancel',
      }
    }

    // 3. Non-nullable column violations (error)
    if (issues.unmappedNonNullableColumns.length > 0) {
      return {
        type: 'error',
        canProceed: false,
        title: 'Error: Null Constraint Violation',
        message: `Target table has NOT NULL constraints. Either modify table to allow nulls, provide values for all required fields, or set database defaults.
        Required columns: ${issues.unmappedNonNullableColumns.join(', ')}`,
        okButtonText: 'OK',
        cancelButtonText: 'Cancel',
      }
    }

    // 4. Unmapped DEFAULT columns (warning)
    if (issues.unmappedDefaultColumns.length > 0) {
      return {
        type: 'warning',
        canProceed: true,
        title: 'Default Values Will Be Used',
        message: `The following columns have DEFAULT expressions and are not mapped. They will be automatically populated by ClickHouse during insert:
        ${issues.unmappedDefaultColumns.join(', ')}

        Do you want to continue?`,
        okButtonText: 'Continue',
        cancelButtonText: 'Cancel',
      }
    }

    // 5. Unmapped nullable columns (warning)
    if (mappedFieldsCount < totalColumnsCount && issues.unmappedNullableColumns.length > 0) {
      return {
        type: 'warning',
        canProceed: true,
        title: 'Field Count Mismatch',
        message: `Are you sure you want to deploy this pipeline while event field count (${mappedFieldsCount}) is less than table columns (${totalColumnsCount})? Some columns may not receive data.
        The following columns will be set to NULL: ${issues.unmappedNullableColumns.join(', ')}`,
        okButtonText: 'Continue',
        cancelButtonText: 'Cancel',
      }
    }

    // 6. Extra event fields (warning)
    if (issues.extraEventFields.length > 0) {
      return {
        type: 'warning',
        canProceed: true,
        title: 'Extra Fields Detected',
        message: `Some incoming event fields will not be mapped to table columns. Unmapped fields will be dropped during processing. Do you want to continue with deployment?
        Unmapped fields: ${issues.extraEventFields.join(', ')}`,
        okButtonText: 'Continue',
        cancelButtonText: 'Cancel',
      }
    }

    return null // No validation issues
  }, [validationIssues, mappedColumns, tableSchema.columns])

  return {
    validationIssues,
    validateMapping,
  }
}
