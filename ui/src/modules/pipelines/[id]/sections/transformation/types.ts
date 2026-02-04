import { StepKeys } from '@/src/config/constants'

/**
 * Common props shared by all transformation cards
 */
export interface TransformationCardBaseProps {
  onStepClick: (step: StepKeys, topicIndex?: number) => void
  disabled: boolean
  activeStep: StepKeys | null
}

/**
 * Props for cards that need validation
 */
export interface TransformationCardWithValidationProps extends TransformationCardBaseProps {
  validation: TransformationValidation
}

/**
 * Validation object structure passed to transformation components
 */
export interface TransformationValidation {
  kafkaValidation?: any
  clickhouseConnectionValidation?: any
  clickhouseDestinationValidation?: any
  joinValidation?: any
  topicsValidation?: any
  deduplicationValidation?: any
  filterValidation?: any
}

/**
 * Common props for case components (DeduplicationCase, JoinCase, etc.)
 */
export interface TransformationCaseBaseProps extends TransformationCardBaseProps {
  destinationTable: string
  totalSourceFields: number
  totalDestinationColumns: number
  validation: TransformationValidation
  pipeline: any
}
