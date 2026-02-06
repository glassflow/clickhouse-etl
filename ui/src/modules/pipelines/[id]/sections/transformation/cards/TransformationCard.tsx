import SingleCard from '../../../SingleColumnCard'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import type { TransformationCardBaseProps } from '../types'

interface TransformationCardProps extends TransformationCardBaseProps {
  pipeline: any
}

/**
 * Transformation card component to display stateless transformation configuration
 */
export function TransformationCard({ onStepClick, disabled, activeStep, pipeline }: TransformationCardProps) {
  // Use proper selector for reactivity
  const transformationConfig = useStore((state) => state.transformationStore.transformationConfig)

  // Check if transformations are enabled (from store or pipeline)
  // Note: After hydration, stateless_transformation is converted to transformation format
  // So we check store first, then hydrated pipeline, then raw API format
  const hasStatelessTransformation =
    transformationConfig.enabled ||
    pipeline?.transformation?.enabled === true ||
    pipeline?.stateless_transformation?.enabled === true

  // Get field count from store or pipeline (prioritize store, then hydrated, then raw API)
  const fieldCount =
    transformationConfig.fields?.length ||
    pipeline?.transformation?.fields?.length ||
    pipeline?.stateless_transformation?.config?.transform?.length ||
    0

  // Only show card if transformations are enabled and have fields
  if (!hasStatelessTransformation || fieldCount === 0) {
    return null
  }

  // Determine the display value
  const fieldLabel = fieldCount === 1 ? '1 field' : `${fieldCount} fields`

  return (
    <SingleCard
      label={['Transformations']}
      value={[fieldLabel]}
      orientation="center"
      width="full"
      onClick={() => onStepClick(StepKeys.TRANSFORMATION_CONFIGURATOR)}
      disabled={disabled}
      selected={activeStep === StepKeys.TRANSFORMATION_CONFIGURATOR}
    />
  )
}
