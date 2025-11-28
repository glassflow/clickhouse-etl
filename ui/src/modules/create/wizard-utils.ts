import { StepKeys } from '@/src/config/constants'
import { KafkaConnectionContainer } from '../kafka/KafkaConnectionContainer'
import { KafkaTopicSelector } from '../kafka/KafkaTopicSelector'
import { DeduplicationConfigurator } from '../deduplication/DeduplicationConfigurator'
import { ClickhouseConnectionContainer } from '../clickhouse/ClickhouseConnectionContainer'
import { ClickhouseMapper } from '../clickhouse/ClickhouseMapper'
import { ReviewConfiguration } from '../review/ReviewConfiguration'
import { JoinConfigurator } from '../join/JoinConfigurator'
import { OperationKeys } from '@/src/config/constants'
import type { SidebarStep } from './WizardSidebar'

// Re-export step icons for external use
export { getStepIcon, stepIcons, type StepIconComponent } from './wizard-step-icons'

// Sidebar step configuration for display in the wizard sidebar
// Maps step keys to display titles and hierarchy information
// Icons are defined separately in wizard-step-icons.tsx
const sidebarStepConfig: Record<StepKeys, Omit<SidebarStep, 'key'>> = {
  [StepKeys.KAFKA_CONNECTION]: {
    title: 'Kafka Connection',
    parent: null,
  },
  [StepKeys.TOPIC_SELECTION_1]: {
    title: 'Select Topic',
    parent: null,
  },
  [StepKeys.TOPIC_SELECTION_2]: {
    title: 'Select Right Topic',
    parent: null,
  },
  [StepKeys.DEDUPLICATION_CONFIGURATOR]: {
    title: 'Deduplicate',
    parent: StepKeys.TOPIC_SELECTION_1, // substep of topic selection
  },
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1]: {
    title: 'Select Left Topic',
    parent: null,
  },
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2]: {
    title: 'Select Right Topic',
    parent: null,
  },
  [StepKeys.JOIN_CONFIGURATOR]: {
    title: 'Join Configuration',
    parent: null,
  },
  [StepKeys.CLICKHOUSE_CONNECTION]: {
    title: 'ClickHouse Connection',
    parent: null,
  },
  [StepKeys.CLICKHOUSE_MAPPER]: {
    title: 'Select Destination',
    parent: null,
  },
  [StepKeys.REVIEW_CONFIGURATION]: {
    title: 'Review & Deploy',
    parent: null,
  },
  [StepKeys.DEPLOY_PIPELINE]: {
    title: 'Deploy Pipeline',
    parent: null,
  },
}

// Legacy journeys kept for backward compatibility
export const deduplicationJourney = [
  StepKeys.KAFKA_CONNECTION,
  StepKeys.TOPIC_SELECTION_1,
  StepKeys.DEDUPLICATION_CONFIGURATOR,
  StepKeys.CLICKHOUSE_CONNECTION,
  StepKeys.CLICKHOUSE_MAPPER,
  StepKeys.REVIEW_CONFIGURATION,
]

export const joinJourney = [
  StepKeys.KAFKA_CONNECTION,
  StepKeys.TOPIC_SELECTION_1,
  StepKeys.TOPIC_SELECTION_2,
  StepKeys.JOIN_CONFIGURATOR,
  StepKeys.CLICKHOUSE_CONNECTION,
  StepKeys.CLICKHOUSE_MAPPER,
  StepKeys.REVIEW_CONFIGURATION,
]

export const ingestOnlyJourney = [
  StepKeys.KAFKA_CONNECTION,
  StepKeys.TOPIC_SELECTION_1,
  StepKeys.CLICKHOUSE_CONNECTION,
  StepKeys.CLICKHOUSE_MAPPER,
  StepKeys.REVIEW_CONFIGURATION,
]

export const deduplicateJoinJourney = [
  StepKeys.KAFKA_CONNECTION,
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
  StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
  StepKeys.JOIN_CONFIGURATOR,
  StepKeys.CLICKHOUSE_CONNECTION,
  StepKeys.CLICKHOUSE_MAPPER,
  StepKeys.REVIEW_CONFIGURATION,
]

// New topic count-based journeys
export const getSingleTopicJourney = (): StepKeys[] => {
  // 1 Topic: Kafka Connection → Topic Selection → ClickHouse Connection → Mapper → Review
  // Deduplication is configured optionally within the topic selector
  return [
    StepKeys.KAFKA_CONNECTION,
    StepKeys.TOPIC_SELECTION_1,
    StepKeys.DEDUPLICATION_CONFIGURATOR,
    StepKeys.CLICKHOUSE_CONNECTION,
    StepKeys.CLICKHOUSE_MAPPER,
    StepKeys.REVIEW_CONFIGURATION,
  ]
}

export const getTwoTopicJourney = (): StepKeys[] => {
  // 2 Topics: Kafka Connection → Topic 1 Selection → Topic 2 Selection → Join Configurator → ClickHouse Connection → Mapper → Review
  // Deduplication is configured optionally per-topic within each topic selector
  return [
    StepKeys.KAFKA_CONNECTION,
    StepKeys.TOPIC_SELECTION_1,
    StepKeys.DEDUPLICATION_CONFIGURATOR,
    StepKeys.TOPIC_SELECTION_2,
    StepKeys.DEDUPLICATION_CONFIGURATOR,
    StepKeys.JOIN_CONFIGURATOR,
    StepKeys.CLICKHOUSE_CONNECTION,
    StepKeys.CLICKHOUSE_MAPPER,
    StepKeys.REVIEW_CONFIGURATION,
  ]
}

// Convert a journey array to sidebar steps with hierarchy
// This function includes all steps from the journey plus any substeps that belong to those steps
// Steps that have a parent are excluded from the main journey steps (they're substeps, not main steps)
export const getSidebarSteps = (journey: StepKeys[], topicCount?: number): SidebarStep[] => {
  // Separate main steps (no parent) from substeps (have a parent)
  const mainSteps: SidebarStep[] = []
  const substeps: SidebarStep[] = []

  journey.forEach((stepKey, index) => {
    const config = sidebarStepConfig[stepKey]
    if (!config) return

    // Get the title, potentially modified based on topic count
    let title = config.title
    if (stepKey === StepKeys.TOPIC_SELECTION_1 && topicCount === 2) {
      // For multi-topic journeys, first topic should be "Select Left Topic"
      title = 'Select Left Topic'
    }

    // For steps that can be substeps but need dynamic parent detection
    // (e.g., DEDUPLICATION_CONFIGURATOR appearing multiple times with different parents)
    if (stepKey === StepKeys.DEDUPLICATION_CONFIGURATOR) {
      // Find the most recent topic selection step before this one
      let parentStep: StepKeys | null = null
      for (let i = index - 1; i >= 0; i--) {
        const prevStep = journey[i]
        if (
          prevStep === StepKeys.TOPIC_SELECTION_1 ||
          prevStep === StepKeys.TOPIC_SELECTION_2 ||
          prevStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1 ||
          prevStep === StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2
        ) {
          parentStep = prevStep
          break
        }
      }

      if (parentStep) {
        // This is a substep of the topic selection
        substeps.push({
          key: stepKey,
          title: config.title,
          parent: parentStep,
        })
        return
      }
    }

    // Check if this step has a parent defined in config
    if (config.parent !== null && config.parent !== undefined) {
      // Check if the parent appears before this step in the journey
      const parentIndex = journey.indexOf(config.parent)
      if (parentIndex !== -1 && parentIndex < index) {
        // This is a substep - use the parent from config
        substeps.push({
          key: stepKey,
          ...config,
          title, // Use potentially modified title
        })
        return
      }
    }

    // Otherwise, it's a main step
    mainSteps.push({
      key: stepKey,
      ...config,
      title, // Use potentially modified title
    })
  })

  // Combine main steps and substeps
  return [...mainSteps, ...substeps]
}

// Get sidebar steps for single topic journey
export const getSingleTopicSidebarSteps = (): SidebarStep[] => {
  return getSidebarSteps(getSingleTopicJourney(), 1)
}

// Get sidebar steps for two topic journey
export const getTwoTopicSidebarSteps = (): SidebarStep[] => {
  return getSidebarSteps(getTwoTopicJourney(), 2)
}

// Get sidebar steps based on topic count
export const getWizardSidebarSteps = (topicCount: number | undefined): SidebarStep[] => {
  if (!topicCount || topicCount < 1 || topicCount > 2) {
    return []
  }

  if (topicCount === 1) {
    return getSingleTopicSidebarSteps()
  } else {
    return getTwoTopicSidebarSteps()
  }
}

export const componentsMap = {
  [StepKeys.KAFKA_CONNECTION]: KafkaConnectionContainer,
  [StepKeys.TOPIC_SELECTION_1]: KafkaTopicSelector,
  [StepKeys.TOPIC_SELECTION_2]: KafkaTopicSelector,
  [StepKeys.DEDUPLICATION_CONFIGURATOR]: DeduplicationConfigurator,
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1]: KafkaTopicSelector,
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2]: KafkaTopicSelector,
  [StepKeys.JOIN_CONFIGURATOR]: JoinConfigurator,
  [StepKeys.CLICKHOUSE_CONNECTION]: ClickhouseConnectionContainer,
  [StepKeys.CLICKHOUSE_MAPPER]: ClickhouseMapper,
  [StepKeys.REVIEW_CONFIGURATION]: ReviewConfiguration,
}

// Helper function to convert journey array to component map
const getJourneyComponents = (journey: StepKeys[]): Record<string, React.ComponentType<any>> => {
  return journey.reduce(
    (acc, step) => {
      // @ts-expect-error - FIXME: fix this later
      acc[step] = componentsMap[step]
      return acc
    },
    {} as Record<StepKeys, React.ComponentType<any>>,
  )
}

// New function: Get wizard journey steps based on topic count
export const getWizardJourneySteps = (topicCount: number | undefined): Record<string, React.ComponentType<any>> => {
  if (!topicCount || topicCount < 1 || topicCount > 2) {
    // Return empty object if topicCount is invalid
    return {}
  }

  if (topicCount === 1) {
    return getJourneyComponents(getSingleTopicJourney())
  } else {
    return getJourneyComponents(getTwoTopicJourney())
  }
}

// Legacy function: Get wizard journey steps based on operation (for backward compatibility)
export const getWizardJourneyStepsFromOperation = (
  operation: string | undefined,
): Record<string, React.ComponentType<any>> => {
  if (!operation) {
    // Return empty object if operation is undefined
    return {}
  }

  // Map operation to topic count for backward compatibility
  // This allows existing code to still work while we migrate
  switch (operation) {
    case OperationKeys.DEDUPLICATION:
      return getJourneyComponents(deduplicationJourney)
    case OperationKeys.JOINING:
      return getJourneyComponents(joinJourney)
    case OperationKeys.INGEST_ONLY:
      return getJourneyComponents(ingestOnlyJourney)
    case OperationKeys.DEDUPLICATION_JOINING:
      return getJourneyComponents(deduplicateJoinJourney)
    default:
      return {}
  }
}
