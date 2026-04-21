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

  // Reset to initial state when filter is absent or explicitly disabled.
  // Using resetFilterStore() (rather than individual setters) is important: it clears the
  // entire filterConfig including the root group tree, preventing stale rules from a previous
  // pipeline creation or edit session from showing up in read-only view.
  if (!filter || !filter.enabled) {
    filterStore.resetFilterStore()
    return
  }

  // filter.enabled is truthy — restore the active filter state
  filterStore.setFilterEnabled(true)

  // Set the expression string if filter has an expression.
  // Expressions saved after the logic inversion are wrapped with !() so the backend's
  // "drop when true" logic produces SQL WHERE semantics (keep when user condition is true).
  // Strip the wrapper here so the UI always shows the user's "keep" condition.
  if (filter.expression) {
    const wrapperMatch = filter.expression.match(/^!\((.+)\)$/)
    const userExpression = wrapperMatch ? wrapperMatch[1] : filter.expression

    filterStore.setExpressionString(userExpression)
    // Mark backend validation as valid since this is a saved/validated expression
    filterStore.setBackendValidation({ status: 'valid' })

    // Try to parse the expression and reconstruct the tree structure
    const parseResult = parseExprToFilterTree(userExpression)

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
