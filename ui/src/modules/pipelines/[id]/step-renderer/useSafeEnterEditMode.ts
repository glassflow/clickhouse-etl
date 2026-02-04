import { useCallback } from 'react'
import { useStore } from '@/src/store'

/**
 * Hook that provides a safe way to enter edit mode
 * Only calls enterEditMode if we're not already in global edit mode
 * This prevents re-hydration which would overwrite unsaved changes from other sections
 */
export function useSafeEnterEditMode() {
  const { coreStore } = useStore()
  const { enterEditMode, mode: globalMode } = coreStore

  /**
   * Safely enter edit mode for a pipeline
   * Only enters if not already in global edit mode
   * @returns true if edit mode was entered, false if already in edit mode
   */
  const safeEnterEditMode = useCallback(
    (pipeline: any): boolean => {
      if (globalMode !== 'edit') {
        enterEditMode(pipeline)
        return true
      }
      return false
    },
    [globalMode, enterEditMode],
  )

  return {
    safeEnterEditMode,
    isInEditMode: globalMode === 'edit',
    globalMode,
  }
}
