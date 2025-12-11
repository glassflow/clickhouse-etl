import { useStore } from '../index'
import { parseExprToFilterTree } from '@/src/modules/filter/parser/exprParser'

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
        console.warn('[Filter Hydration] Expression parsed with unsupported features:', parseResult.unsupportedFeatures)
      }
    } else {
      // Failed to parse - keep expression string for read-only display
      // The UI will show the expression in read-only mode
      console.warn(
        '[Filter Hydration] Could not parse expression into tree structure:',
        parseResult.error,
        'Expression will be shown in read-only mode.',
      )
    }
  } else {
    filterStore.setExpressionString('')
    filterStore.setBackendValidation({ status: 'idle' })
  }
}
