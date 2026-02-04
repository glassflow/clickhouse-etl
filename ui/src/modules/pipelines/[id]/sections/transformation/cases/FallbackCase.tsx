import SingleCard from '../../../SingleColumnCard'
import DoubleColumnCard from '../../../DoubleColumnCard'
import { StepKeys } from '@/src/config/constants'
import { TransformationCard } from '../cards'
import type { TransformationCaseBaseProps } from '../types'

interface FallbackCaseProps extends TransformationCaseBaseProps {
  topicsCount: number
  hasJoin: boolean
}

/**
 * Fallback case for edge cases that don't match other patterns
 */
export function FallbackCase({
  topicsCount,
  hasJoin,
  destinationTable,
  totalSourceFields,
  totalDestinationColumns,
  onStepClick,
  disabled,
  activeStep,
  pipeline,
}: FallbackCaseProps) {
  return (
    <div className="flex flex-col gap-4">
      <SingleCard
        label={['Configuration']}
        value={[`${topicsCount} topic(s), Join: ${hasJoin ? 'Yes' : 'No'}`]}
        orientation="center"
        width="full"
        disabled={disabled}
      />
      <TransformationCard onStepClick={onStepClick} disabled={disabled} activeStep={activeStep} pipeline={pipeline} />
      <DoubleColumnCard
        label={['Destination Table', 'Schema Mapping']}
        value={[destinationTable, `${totalSourceFields} fields → ${totalDestinationColumns} columns`]}
        width="full"
        disabled={disabled}
      />
    </div>
  )
}
