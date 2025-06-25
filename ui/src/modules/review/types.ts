import { StepKeys } from '@/src/config/constants'

export interface ReviewConfigurationProps {
  steps: any
  onNext: (step: StepKeys) => void
  validate?: (step: StepKeys, data: any) => boolean
}
