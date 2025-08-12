import { useCallback } from 'react'
import { StepKeys } from '@/src/config/constants'

// Determine index based on current step (more reliable than operationsSelected during editing)
export function useGetIndex(currentStep: string) {
  const getIndex = useCallback(() => {
    if (!currentStep) return 0

    // Determine index based on step name, which is more reliable during editing
    if (currentStep === StepKeys.TOPIC_SELECTION_1 || currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1) {
      return 0 // Left topic (first topic)
    } else if (
      currentStep === StepKeys.TOPIC_SELECTION_2 ||
      currentStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2
    ) {
      return 1 // Right topic (second topic)
    }

    // For any other step, default to index 0
    return 0
  }, [currentStep])

  return getIndex
}

export default useGetIndex
