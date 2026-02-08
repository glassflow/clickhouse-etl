import SingleCard from '../../../SingleColumnCard'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import type { TransformationCardBaseProps } from '../types'

interface TypeVerificationCardProps extends TransformationCardBaseProps {
  topicIndex?: number
  label?: string
}

/**
 * Type Verification card component to display Kafka event field types
 */
export function TypeVerificationCard({
  onStepClick,
  disabled,
  activeStep,
  topicIndex = 0,
  label = 'Verify Field Types',
}: TypeVerificationCardProps) {
  // Use proper selector for reactivity
  const topic = useStore((state) => state.topicsStore.getTopic(topicIndex))

  // Get schema from topic if available
  const schema = (topic as any)?.schema?.fields || []
  const fieldCount = schema.length

  // Determine display value
  let displayValue: string
  if (fieldCount > 0) {
    const fieldLabel = fieldCount === 1 ? '1 field' : `${fieldCount} fields`
    // Check if any types were modified from inferred
    const modifiedCount = schema.filter((f: any) => f.userType !== f.inferredType).length
    if (modifiedCount > 0) {
      displayValue = `${fieldLabel} (${modifiedCount} modified)`
    } else {
      displayValue = `${fieldLabel} verified`
    }
  } else {
    displayValue = 'Not configured'
  }

  return (
    <SingleCard
      label={[label]}
      value={[displayValue]}
      orientation="center"
      width="full"
      onClick={() => onStepClick(StepKeys.KAFKA_TYPE_VERIFICATION, topicIndex)}
      disabled={disabled}
      selected={activeStep === StepKeys.KAFKA_TYPE_VERIFICATION}
    />
  )
}
