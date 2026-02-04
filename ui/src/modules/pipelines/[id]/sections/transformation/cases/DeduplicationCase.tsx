import SingleCard from '../../../SingleColumnCard'
import DoubleColumnCard from '../../../DoubleColumnCard'
import { StepKeys } from '@/src/config/constants'
import { isFiltersEnabled } from '@/src/config/feature-flags'
import { FilterCard, TypeVerificationCard, TransformationCard, DeduplicationKeyCard } from '../cards'
import type { TransformationCaseBaseProps } from '../types'

interface DeduplicationCaseProps extends TransformationCaseBaseProps {
  topic: any
  hasDedup: boolean
}

/**
 * Single topic case - covers deduplication or ingest only pipelines
 */
export function DeduplicationCase({
  topic,
  hasDedup,
  destinationTable,
  totalSourceFields,
  totalDestinationColumns,
  onStepClick,
  disabled,
  validation,
  activeStep,
  pipeline,
}: DeduplicationCaseProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Top card: Topic */}
      <SingleCard
        label={['Topic']}
        value={[topic.name]}
        orientation="center"
        width="full"
        onClick={() => onStepClick(StepKeys.TOPIC_SELECTION_1, 0)}
        disabled={disabled}
        validation={validation}
        selected={activeStep === StepKeys.TOPIC_SELECTION_1}
      />

      {/* Type Verification card */}
      <TypeVerificationCard onStepClick={onStepClick} disabled={disabled} activeStep={activeStep} topicIndex={0} />

      {/* Middle card: Deduplication Key (only if dedup is enabled) */}
      {hasDedup && (
        <DeduplicationKeyCard
          onStepClick={onStepClick}
          disabled={disabled}
          validation={validation}
          activeStep={activeStep}
          topicIndex={0}
        />
      )}

      {/* Filter card (only if filters feature is enabled) */}
      {isFiltersEnabled() && (
        <FilterCard onStepClick={onStepClick} disabled={disabled} validation={validation} activeStep={activeStep} />
      )}

      {/* Transformation card (if stateless transformations are enabled) */}
      <TransformationCard onStepClick={onStepClick} disabled={disabled} activeStep={activeStep} pipeline={pipeline} />

      {/* Bottom card: Destination Table and Schema Mapping */}
      <DoubleColumnCard
        label={['Destination Table', 'Schema Mapping']}
        value={[destinationTable, `${totalSourceFields} fields → ${totalDestinationColumns} columns`]}
        width="full"
        onClick={() => onStepClick(StepKeys.CLICKHOUSE_MAPPER)}
        disabled={disabled}
        validation={validation.clickhouseDestinationValidation}
        selected={activeStep === StepKeys.CLICKHOUSE_MAPPER}
      />
    </div>
  )
}
