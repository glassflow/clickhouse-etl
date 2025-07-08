import { ClickhouseMapper } from './ClickhouseMapper'
import { StepKeys } from '@/src/config/constants'

interface ClickhouseJoinMapperProps {
  onNext: (step: StepKeys) => void
  primaryIndex: number
  secondaryIndex: number
}

export function ClickhouseJoinMapper({ onNext, primaryIndex, secondaryIndex }: ClickhouseJoinMapperProps) {
  return <ClickhouseMapper onNext={onNext} primaryIndex={primaryIndex} secondaryIndex={secondaryIndex} mode="join" />
}
