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

function GroupLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="caption-2 uppercase tracking-widest font-semibold text-[var(--color-foreground-neutral-faded)] opacity-50 whitespace-nowrap">
        {label}
      </span>
      <div className="h-px flex-1 bg-[var(--surface-border)] opacity-30" />
    </div>
  )
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
    <div className="flex flex-col gap-2.5">
      <GroupLabel label="Data Source" />
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
      <TypeVerificationCard onStepClick={onStepClick} disabled={disabled} activeStep={activeStep} topicIndex={0} />

      <GroupLabel label="Processing" />
      {hasDedup && (
        <DeduplicationKeyCard
          onStepClick={onStepClick}
          disabled={disabled}
          validation={validation}
          activeStep={activeStep}
          topicIndex={0}
        />
      )}
      {isFiltersEnabled() && (
        <FilterCard onStepClick={onStepClick} disabled={disabled} validation={validation} activeStep={activeStep} />
      )}
      <TransformationCard onStepClick={onStepClick} disabled={disabled} activeStep={activeStep} pipeline={pipeline} />

      <GroupLabel label="Destination" />
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
