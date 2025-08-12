import { StepKeys } from '@/src/config/constants'

export interface ReviewConfigurationProps {
  steps: any
  onCompleteStep: (step: StepKeys) => void
  validate?: (step: StepKeys, data: any) => boolean
}
