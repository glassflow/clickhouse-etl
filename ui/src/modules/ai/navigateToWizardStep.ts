/**
 * After materialization, set the wizard step state so the user lands at the
 * correct step when navigating to `/pipelines/create`.
 *
 * Runs CLIENT-SIDE only.
 */

import { useStore } from '@/src/store'
import { getWizardJourneyInstances } from '@/src/modules/create/utils'
import { StepKeys } from '@/src/config/constants'
import type { PipelineIntentModel } from './types'

/**
 * Marks wizard steps as completed based on what the AI intent covered,
 * and sets the active step to the first step that needs user attention.
 */
export function navigateToWizardStep(intent: PipelineIntentModel): { activeStepId: string | null } {
  const store = useStore.getState()
  const topicCount = intent.topicCount || 1
  const journey = getWizardJourneyInstances(topicCount)

  if (!journey.length) return { activeStepId: null }

  const completedStepIds: string[] = []
  let activeStepId: string | null = journey[0]?.id ?? null

  for (const instance of journey) {
    const { key } = instance

    if (key === StepKeys.KAFKA_CONNECTION) {
      if (intent.kafka?.connectionStatus === 'valid') {
        completedStepIds.push(instance.id)
        continue
      }
      activeStepId = instance.id
      break
    }

    if (key === StepKeys.TOPIC_SELECTION_1 || key === StepKeys.TOPIC_SELECTION_2) {
      const topicIdx = instance.topicIndex ?? 0
      const topicIntent = intent.topics?.[topicIdx]
      if (topicIntent?.topicName) {
        completedStepIds.push(instance.id)
        continue
      }
      activeStepId = instance.id
      break
    }

    if (key === StepKeys.KAFKA_TYPE_VERIFICATION) {
      // Auto-complete when operationType is already known from AI session
      if (intent.operationType) {
        completedStepIds.push(instance.id)
        continue
      }
      activeStepId = instance.id
      break
    }

    if (key === StepKeys.DEDUPLICATION_CONFIGURATOR) {
      const topicIdx = instance.topicIndex ?? 0
      const topicIntent = intent.topics?.[topicIdx]
      if (intent.operationType === 'deduplication' && topicIntent?.deduplicationKey) {
        completedStepIds.push(instance.id)
        continue
      }
      if (intent.operationType === 'ingest-only') {
        // Skip deduplication for ingest-only
        completedStepIds.push(instance.id)
        continue
      }
      activeStepId = instance.id
      break
    }

    if (key === StepKeys.FILTER_CONFIGURATOR) {
      if (intent.filter?.expression) {
        completedStepIds.push(instance.id)
      } else {
        completedStepIds.push(instance.id) // Filter is optional, always skip to next
      }
      continue
    }

    if (key === StepKeys.TRANSFORMATION_CONFIGURATOR) {
      completedStepIds.push(instance.id) // Transformation is optional, skip
      continue
    }

    if (key === StepKeys.CLICKHOUSE_CONNECTION) {
      if (intent.clickhouse?.connectionStatus === 'valid') {
        completedStepIds.push(instance.id)
        continue
      }
      activeStepId = instance.id
      break
    }

    if (key === StepKeys.CLICKHOUSE_MAPPER) {
      if (intent.destination?.tableName && intent.destination?.columnMappings?.length) {
        completedStepIds.push(instance.id)
        continue
      }
      activeStepId = instance.id
      break
    }

    if (key === StepKeys.PIPELINE_RESOURCES) {
      // Has safe defaults — AI never configures this, always auto-complete
      completedStepIds.push(instance.id)
      continue
    }

    // For remaining steps, stop here
    activeStepId = instance.id
    break
  }

  // Apply to store
  store.stepsStore.setCompletedStepIds(completedStepIds)
  if (activeStepId) {
    store.stepsStore.setActiveStepId(activeStepId)
  }

  return { activeStepId }
}
