import { useStore } from '../index'

/**
 * Hydrate filter configuration from pipeline config
 * This restores the filter state when loading an existing pipeline for viewing/editing
 */
export function hydrateFilter(pipelineConfig: any) {
  const filter = pipelineConfig?.filter
  const filterStore = useStore.getState().filterStore

  if (!filter) {
    // No filter config - reset to initial state
    filterStore.resetFilterStore()
    return
  }

  // Set filter enabled state
  filterStore.setFilterEnabled(!!filter.enabled)

  // Set the expression string if filter is enabled and has an expression
  if (filter.enabled && filter.expression) {
    filterStore.setExpressionString(filter.expression)
    // Mark backend validation as valid since this is a saved/validated expression
    filterStore.setBackendValidation({ status: 'valid' })
  } else {
    filterStore.setExpressionString('')
    filterStore.setBackendValidation({ status: 'idle' })
  }

  // Note: We don't reconstruct the tree structure from the expression string
  // because that would require a full expression parser.
  // The expression string is sufficient for the backend.
  // If the user wants to edit the filter, they can rebuild it using the UI.
}
