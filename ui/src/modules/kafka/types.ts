import type { StepKeys } from '@/src/config/constants'
import type { PipelineActionState } from '@/src/hooks/usePipelineActions'

// Type definitions for deduplication config
// NOTE: not used for now.
export type DeduplicationConfig = {
  enabled: boolean
  window: number
  unit: 'seconds' | 'minutes' | 'hours' | 'days'
  key: string
  keyType: string
}

export type TopicSelectorSteps = Record<string, { key?: string; title?: string; description?: string }>

export type TopicSelectorProps = {
  steps?: TopicSelectorSteps
  onCompleteStep: (stepName: string) => void
  validate: (stepName: StepKeys | string, data?: unknown) => boolean
  currentStep?: string
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
  enableDeduplication?: boolean
  onDeduplicationChange?: (config: DeduplicationConfig) => void
  initialDeduplicationConfig?: Partial<DeduplicationConfig>
  pipelineActionState?: PipelineActionState
  onCompleteStandaloneEditing?: () => void
}

export type { PipelineActionState }

/** Field type info for type verification (inferred + user type, manually added, removed). */
export interface FieldTypeInfo {
  name: string
  inferredType: string
  userType: string
  isManuallyAdded: boolean
  isRemoved: boolean
}
