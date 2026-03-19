import { useStore } from '../index'
import { parseExprToFilterTree } from '@/src/modules/filter/parser/exprParser'
import { structuredLogger } from '@/src/observability'

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

    // Try to parse the expression and reconstruct the tree structure
    const parseResult = parseExprToFilterTree(filter.expression)

    if (parseResult.success && parseResult.filterGroup) {
      // Successfully parsed - set the full filter config with reconstructed tree
      filterStore.setFilterConfig({
        enabled: true,
        root: parseResult.filterGroup,
      })

      // Log any unsupported features for debugging
      if (parseResult.unsupportedFeatures && parseResult.unsupportedFeatures.length > 0) {
        structuredLogger.warn('Filter hydration expression parsed with unsupported features', { unsupported_features: parseResult.unsupportedFeatures.join(', ') })
      }
    } else {
      // Failed to parse - keep expression string for read-only display
      // The UI will show the expression in read-only mode
      structuredLogger.warn('Filter hydration could not parse expression into tree structure, showing in read-only mode', { error: parseResult.error })
    }
  } else {
    filterStore.setExpressionString('')
    filterStore.setBackendValidation({ status: 'idle' })
  }
}
