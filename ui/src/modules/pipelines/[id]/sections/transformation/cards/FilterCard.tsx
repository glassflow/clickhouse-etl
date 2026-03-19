import SingleCard from '../../../SingleColumnCard'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { countRulesInGroup } from '@/src/modules/filter/utils'
import type { TransformationCardWithValidationProps } from '../types'

/**
 * Filter card component to display filter configuration
 */
export function FilterCard({ onStepClick, disabled, validation, activeStep }: TransformationCardWithValidationProps) {
  const filterConfig = useStore((state) => state.filterStore.filterConfig)
  const expressionString = useStore((state) => state.filterStore.expressionString)

  // Count rules in the tree structure
  const ruleCount = filterConfig.root ? countRulesInGroup(filterConfig.root) : 0

  // Determine if filter is configured (either has rules in tree or has expression string from hydration)
  const hasFilter = (filterConfig.enabled && ruleCount > 0) || (filterConfig.enabled && expressionString)

  // Determine the display value
  let displayValue: string
  if (hasFilter) {
    if (ruleCount > 0) {
      const ruleLabel = ruleCount === 1 ? '1 rule' : `${ruleCount} rules`
      const combinator = filterConfig.root?.combinator || 'and'
      displayValue = `${ruleLabel} (${combinator.toUpperCase()})`
    } else if (expressionString) {
      // Filter was hydrated from expression string but tree not reconstructed
      displayValue = 'Expression configured'
    } else {
      displayValue = 'Configured'
    }
  } else {
    displayValue = 'No filter configured'
  }

  return (
    <SingleCard
      label={['Filter']}
      value={[displayValue]}
      orientation="center"
      width="full"
      onClick={() => onStepClick(StepKeys.FILTER_CONFIGURATOR)}
      disabled={disabled}
      validation={validation?.filterValidation}
      selected={activeStep === StepKeys.FILTER_CONFIGURATOR}
    />
  )
}
