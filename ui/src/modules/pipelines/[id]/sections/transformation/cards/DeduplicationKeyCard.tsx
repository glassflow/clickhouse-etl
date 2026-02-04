import SingleCard from '../../../SingleColumnCard'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import type { TransformationCardWithValidationProps } from '../types'

interface DeduplicationKeyCardProps extends TransformationCardWithValidationProps {
  topicIndex: number
}

/**
 * Deduplication Key card - shows the deduplication key for a topic
 * Uses proper useStore selector for reactivity (fixes getState() issue)
 */
export function DeduplicationKeyCard({
  onStepClick,
  disabled,
  validation,
  activeStep,
  topicIndex,
}: DeduplicationKeyCardProps) {
  // Use proper selector for reactivity instead of getState()
  const deduplicationConfig = useStore((state) => state.deduplicationStore.getDeduplication(topicIndex))

  return (
    <SingleCard
      label={['Deduplication Key']}
      value={[deduplicationConfig?.key || 'N/A']}
      orientation="center"
      width="full"
      onClick={() => onStepClick(StepKeys.DEDUPLICATION_CONFIGURATOR, topicIndex)}
      disabled={disabled}
      validation={validation.deduplicationValidation}
      selected={activeStep === StepKeys.DEDUPLICATION_CONFIGURATOR}
    />
  )
}
