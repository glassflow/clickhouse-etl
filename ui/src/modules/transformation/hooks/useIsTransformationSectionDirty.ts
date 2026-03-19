'use client'

import { useStore } from '@/src/store'
import { isTransformationSectionDirty } from '../isTransformationSectionDirty'

/**
 * Returns true when the Transformation section has uncommitted changes (compared to
 * section snapshot when present, else last-saved pipeline config). Use in pipeline
 * details to show a confirmation modal before navigating away (sidebar, step card, or close).
 */
export function useIsTransformationSectionDirty(): boolean {
  const transformationConfig = useStore((state) => state.transformationStore.transformationConfig)
  const sectionSnapshot = useStore((state) => state.transformationStore.lastSavedTransformationSnapshot)
  const lastSavedConfig = useStore((state) => state.coreStore.lastSavedConfig)

  return isTransformationSectionDirty(transformationConfig, lastSavedConfig ?? undefined, sectionSnapshot)
}
