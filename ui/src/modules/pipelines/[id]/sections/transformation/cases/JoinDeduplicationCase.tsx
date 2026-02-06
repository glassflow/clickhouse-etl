import SingleColumnCard from '../../../SingleColumnCard'
import DoubleColumnCard from '../../../DoubleColumnCard'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { TypeVerificationCard, TransformationCard } from '../cards'
import type { TransformationCaseBaseProps } from '../types'

interface JoinDeduplicationCaseProps extends TransformationCaseBaseProps {
  leftTopic: any
  rightTopic: any
  leftSource: any
  rightSource: any
}

/**
 * Join & Deduplication case - handles pipelines with both join and full deduplication on both topics
 * Uses proper useStore selectors for reactivity (fixes getState() issue)
 */
export function JoinDeduplicationCase({
  leftTopic,
  rightTopic,
  leftSource,
  rightSource,
  destinationTable,
  totalSourceFields,
  totalDestinationColumns,
  onStepClick,
  disabled,
  validation,
  activeStep,
  pipeline,
}: JoinDeduplicationCaseProps) {
  // Use proper selectors for reactivity instead of getState()
  const leftDedupConfig = useStore((state) => state.deduplicationStore.getDeduplication(0))
  const rightDedupConfig = useStore((state) => state.deduplicationStore.getDeduplication(1))

  const leftDedupKey = leftDedupConfig?.enabled ? leftDedupConfig.key : 'None'
  const rightDedupKey = rightDedupConfig?.enabled ? rightDedupConfig.key : 'None'

  return (
    <div className="flex flex-col gap-4">
      {/* Topics with Dedup Keys - Left and Right */}
      <div className="flex flex-row gap-4">
        <DoubleColumnCard
          label={['Left Topic', 'Dedup Key']}
          value={[leftTopic?.name || 'N/A', leftDedupKey]}
          width="full"
          onClick={() => onStepClick(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1, 0)}
          disabled={disabled}
          validation={validation.topicsValidation}
          selected={activeStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1}
        />

        <DoubleColumnCard
          label={['Dedup Key', 'Right Topic']}
          value={[rightDedupKey, rightTopic?.name || 'N/A']}
          width="full"
          onClick={() => onStepClick(StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2, 1)}
          disabled={disabled}
          validation={validation.topicsValidation}
          selected={activeStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2}
        />
      </div>

      {/* Type Verification - Left and Right */}
      <div className="flex flex-row gap-4">
        <TypeVerificationCard
          onStepClick={onStepClick}
          disabled={disabled}
          activeStep={activeStep}
          topicIndex={0}
          label="Left Topic Types"
        />

        <TypeVerificationCard
          onStepClick={onStepClick}
          disabled={disabled}
          activeStep={activeStep}
          topicIndex={1}
          label="Right Topic Types"
        />
      </div>

      {/* Join Keys - Left and Right */}
      <div className="flex flex-row gap-4">
        <SingleColumnCard
          label={['Left Join Key']}
          orientation="left"
          value={[leftSource?.join_key || 'N/A']}
          width="full"
          onClick={() => onStepClick(StepKeys.JOIN_CONFIGURATOR)}
          disabled={disabled}
          validation={validation.joinValidation}
          selected={activeStep === StepKeys.JOIN_CONFIGURATOR}
        />

        <SingleColumnCard
          label={['Right Join Key']}
          orientation="right"
          value={[rightSource?.join_key || 'N/A']}
          width="full"
          onClick={() => onStepClick(StepKeys.JOIN_CONFIGURATOR)}
          disabled={disabled}
          validation={validation.joinValidation}
          selected={activeStep === StepKeys.JOIN_CONFIGURATOR}
        />
      </div>

      {/* Note: Filter is not available for multi-topic journeys */}

      {/* Transformation card (if stateless transformations are enabled) */}
      <TransformationCard onStepClick={onStepClick} disabled={disabled} activeStep={activeStep} pipeline={pipeline} />

      {/* Destination Table and Schema Mapping */}
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
