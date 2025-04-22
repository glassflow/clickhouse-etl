'use client'

import { useStore } from '@/src/store'
import { StepKeys } from '@/src/config/constants'
import { ClickhouseMapper } from './ClickhouseMapper'
import { ClickhouseJoinMapper } from './ClickhouseJoinMapper'
import { OperationKeys } from '@/src/config/constants'

interface ClickhouseMapperSwitchProps {
  onNext: (step: StepKeys) => void
}

export function ClickhouseMapperSwitch({ onNext }: ClickhouseMapperSwitchProps) {
  const { operationsSelected, topicsStore } = useStore()

  // Determine if we're doing a join operation
  const isJoinOperation =
    operationsSelected.operation === OperationKeys.JOINING ||
    operationsSelected.operation === OperationKeys.DEDUPLICATION_JOINING

  // If we have a join operation, we need to find the primary and secondary topic indices
  if (isJoinOperation) {
    return <ClickhouseJoinMapper onNext={onNext} primaryIndex={0} secondaryIndex={1} />
  }

  // If we're not doing a join, use the regular mapper with the first selected topic
  return <ClickhouseMapper onNext={onNext} index={0} />
}
