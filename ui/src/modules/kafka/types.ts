// Type definitions for deduplication config
// NOTE: not used for now.
export type DeduplicationConfig = {
  enabled: boolean
  window: number
  unit: 'seconds' | 'minutes' | 'hours' | 'days'
  key: string
  keyType: string
}

export type TopicSelectorProps = {
  steps: any
  onCompleteStep: (stepName: string) => void
  validate: (stepName: string, data: any) => boolean
  currentStep?: string
  readOnly?: boolean
  standalone?: boolean
  toggleEditMode?: () => void
  // NEW: Deduplication-specific props
  enableDeduplication?: boolean
  onDeduplicationChange?: (config: DeduplicationConfig) => void
  initialDeduplicationConfig?: Partial<DeduplicationConfig>
  // NEW: Pipeline action state for loading indicators
  pipelineActionState?: any
  onCompleteStandaloneEditing?: () => void
}
