'use client'

import { useMemo } from 'react'
import { TransformationField } from '@/src/store/transformation.store'
import { extractEventFields, type SchemaField } from '@/src/utils/common.client'
import { inferJsonType, getNestedValue } from '@/src/modules/clickhouse/utils'

export interface AvailableField {
  name: string
  type: string
}

/**
 * Hook to derive available fields from multiple sources with priority:
 * 1. Schema fields from KafkaTypeVerification (respects added/removed fields)
 * 2. Fields extracted from the effective event data
 * 3. Fields extracted from existing transformation configurations (fallback)
 *
 * @param schemaFields - Schema fields from KafkaTypeVerification step
 * @param effectiveEventData - Event data with schema modifications applied
 * @param transformationFields - Existing transformation field configurations
 * @returns Array of available fields with name and type
 */
export function useAvailableFields(
  schemaFields: SchemaField[] | undefined,
  effectiveEventData: any,
  transformationFields: TransformationField[]
): AvailableField[] {
  return useMemo((): AvailableField[] => {
    // First priority: Use schema fields from KafkaTypeVerification if available
    // This ensures we respect added/removed fields from the type verification step
    if (schemaFields && schemaFields.length > 0) {
      return schemaFields
        .filter((f) => !f.isRemoved) // Only include active (non-removed) fields
        .map((f) => ({
          name: f.name,
          type: f.userType || f.type || 'string',
        }))
    }

    // Second priority: Extract fields from the effective event data
    if (effectiveEventData && typeof effectiveEventData === 'object') {
      const fieldNames = extractEventFields(effectiveEventData)
      return fieldNames.map((fieldName) => ({
        name: fieldName,
        type: inferJsonType(getNestedValue(effectiveEventData, fieldName)),
      }))
    }

    // Fallback: Extract source fields from existing passthrough transformations
    // This allows editing when the event data isn't loaded yet
    if (transformationFields.length > 0) {
      const fieldsFromTransformations = new Map<string, string>()

      transformationFields.forEach((field) => {
        if (field.type === 'passthrough' && field.sourceField) {
          fieldsFromTransformations.set(field.sourceField, field.sourceFieldType || 'string')
        }
        // Also extract field references from computed field arguments
        if (field.type === 'computed' && field.functionArgs) {
          field.functionArgs.forEach((arg) => {
            if (arg.type === 'field' && arg.fieldName) {
              fieldsFromTransformations.set(arg.fieldName, arg.fieldType || 'string')
            }
          })
        }
      })

      if (fieldsFromTransformations.size > 0) {
        return Array.from(fieldsFromTransformations.entries()).map(([name, type]) => ({
          name,
          type,
        }))
      }
    }

    return []
  }, [schemaFields, effectiveEventData, transformationFields])
}
