'use client'

import { useStore } from '@/src/store'
import { getEffectiveSchema } from '@/src/utils/schema-service'
import type { SchemaField } from '@/src/types/schema'

/**
 * Returns the effective source schema for the current pipeline configuration.
 * Delegates all source-type branching to getEffectiveSchema.
 */
export function useClickhouseMapperEventFields(): SchemaField[] {
  return getEffectiveSchema(useStore.getState())
}
