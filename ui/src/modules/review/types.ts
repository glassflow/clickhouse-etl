import { StepKeys } from '@/src/config/constants'

export interface ReviewConfigurationProps {
  steps: any
  onNext: (step: StepKeys) => void
  validate?: (step: StepKeys, data: any) => boolean
}

export interface KafkaConnectionParams {
  brokers: string[]
  protocol: string
  mechanism?: string
  username?: string
  password?: string
  oauthBearerToken?: string
  root_ca?: string
}
