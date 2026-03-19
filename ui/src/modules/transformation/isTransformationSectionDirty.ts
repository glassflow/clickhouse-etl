/**
 * Dirty detection for the Transformation section.
 * Compares current transformation store state to the last-saved pipeline config
 * so we can warn before navigating away with unsaved changes.
 */

import type { TransformationConfig, TransformationField } from '@/src/store/transformation.store'
import { fieldToExpr } from './utils'

/** Canonical row for comparison (matches pipeline transform array shape) */
interface CanonicalField {
  output_name: string
  output_type: string
  expression: string
}

/**
 * Extract transformation from pipeline config into a canonical sorted array.
 * Handles stateless_transformation (V2) and transformation (legacy).
 */
function getCanonicalTransformFromPipeline(pipelineConfig: any): CanonicalField[] {
  const stateless = pipelineConfig?.stateless_transformation
  const legacy = pipelineConfig?.transformation
  const transformConfig = stateless || legacy

  if (!transformConfig || !transformConfig.enabled) {
    return []
  }

  // Stateless (V2): transform array with expression, output_name, output_type
  const statelessTransform = stateless?.config?.transform as
    | Array<{
        expression?: string
        output_name?: string
        output_type?: string
      }>
    | undefined
  // Legacy: transformation.fields with outputFieldName, outputFieldType, sourceField/rawExpression
  const legacyFields = legacy?.fields as
    | Array<{
        sourceField?: string
        outputFieldName?: string
        outputFieldType?: string
        rawExpression?: string
      }>
    | undefined

  const transformArray = statelessTransform ?? legacyFields ?? []

  const rows: CanonicalField[] = transformArray.map((t: any) => {
    const expression = t.expression ?? (t.sourceField != null ? t.sourceField : (t.rawExpression ?? ''))
    const output_name = t.output_name ?? t.outputFieldName ?? ''
    const output_type = t.output_type ?? t.outputFieldType ?? 'string'
    return { output_name, output_type, expression: String(expression).trim() }
  })

  return rows.sort((a, b) => a.output_name.localeCompare(b.output_name))
}

/**
 * Serialize current transformation config to the same canonical shape.
 */
function getCanonicalTransformFromStore(config: TransformationConfig): CanonicalField[] {
  if (!config.enabled || !config.fields.length) {
    return []
  }

  const rows: CanonicalField[] = config.fields.map((field: TransformationField) => {
    const expr = fieldToExpr(field)
    return {
      output_name: field.outputFieldName ?? '',
      output_type: field.outputFieldType ?? 'string',
      expression: typeof expr === 'string' ? expr.trim() : '',
    }
  })

  return rows.sort((a, b) => a.output_name.localeCompare(b.output_name))
}

function canonicalToKey(fields: CanonicalField[]): string {
  return JSON.stringify(fields)
}

/**
 * Returns true if the current transformation config differs from the section
 * baseline (i.e. there are uncommitted changes). When a section snapshot exists
 * (e.g. after "Save Transformation"), compares to that; otherwise compares to
 * the last-saved pipeline config.
 */
export function isTransformationSectionDirty(
  currentConfig: TransformationConfig,
  lastSavedPipeline: any,
  sectionSnapshot: TransformationConfig | null = null,
): boolean {
  const current = getCanonicalTransformFromStore(currentConfig)

  if (sectionSnapshot) {
    const saved = getCanonicalTransformFromStore(sectionSnapshot)
    return canonicalToKey(current) !== canonicalToKey(saved)
  }

  if (!lastSavedPipeline) {
    return false
  }

  const saved = getCanonicalTransformFromPipeline(lastSavedPipeline)
  return canonicalToKey(current) !== canonicalToKey(saved)
}
