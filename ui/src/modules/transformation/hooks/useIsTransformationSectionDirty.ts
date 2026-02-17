'use client'

import { useStore } from '@/src/store'
import { isTransformationSectionDirty } from '../isTransformationSectionDirty'

/**
 * Returns true when the Transformation section has unsaved changes compared to
 * the last-saved pipeline config. Use in pipeline details to show a confirmation
 * modal before navigating away (sidebar, step card, or close).
 */
export function useIsTransformationSectionDirty(): boolean {
  const transformationConfig = useStore((state) => state.transformationStore.transformationConfig)
  const lastSavedConfig = useStore((state) => state.coreStore.lastSavedConfig)

  return isTransformationSectionDirty(transformationConfig, lastSavedConfig ?? undefined)
}
