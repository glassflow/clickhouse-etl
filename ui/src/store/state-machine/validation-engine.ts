import { DependencyGraph } from './types'
import { DEPENDENCY_GRAPH } from './dependency-graph'
import { StepKeys } from '@/src/config/constants'

/**
 * Distributed Validation Engine
 *
 * This engine manages validation state across all store slices by:
 * 1. Tracking dependencies between sections
 * 2. Automatically invalidating dependent sections when a section changes
 * 3. Providing a centralized way to manage validation across the pipeline
 */
export class DistributedValidationEngine {
  private dependencyGraph: DependencyGraph
  private store: any

  constructor(store: any, dependencyGraph?: DependencyGraph) {
    this.store = store
    this.dependencyGraph = dependencyGraph || DEPENDENCY_GRAPH
  }

  /**
   * Call this when a section is successfully configured
   * This will mark the section as valid and invalidate all dependent sections
   */
  onSectionConfigured(section: StepKeys) {
    // Mark current section as valid
    const currentSlices = this.getStoreSliceForSection(section)
    if (currentSlices && currentSlices.length > 0) {
      currentSlices.forEach((slice: any) => {
        if (slice?.markAsValid) {
          slice.markAsValid()
        }
      })
    }

    // Find and invalidate all dependent sections
    const dependentSections = this.findDependentSections(section)
    dependentSections.forEach((dependentSection) => {
      const dependentSlice = this.getStoreSliceForSection(dependentSection)
      if (dependentSlice && dependentSlice.length > 0) {
        dependentSlice.forEach((slice: any) => {
          if (slice?.markAsInvalidated) {
            slice.markAsInvalidated(section)
          }
        })
      }
    })
  }

  /**
   * Call this when a section's configuration is cleared/reset
   */
  onSectionReset(section: StepKeys) {
    const currentSlice = this.getStoreSliceForSection(section)
    if (currentSlice && currentSlice.length > 0) {
      currentSlice.forEach((slice: any) => {
        if (slice?.markAsNotConfigured) {
          slice.markAsNotConfigured()
        }
      })
    }

    // Also reset all dependent sections
    const dependentSections = this.findDependentSections(section)
    dependentSections.forEach((dependentSection) => {
      const dependentSlice = this.getStoreSliceForSection(dependentSection)
      if (dependentSlice && dependentSlice.length > 0) {
        dependentSlice.forEach((slice: any) => {
          if (slice?.markAsNotConfigured) {
            slice.markAsNotConfigured()
          }
        })
      }
    })
  }

  /**
   * Manually invalidate a specific section
   */
  invalidateSection(section: StepKeys, invalidatedBy: string) {
    const slice = this.getStoreSliceForSection(section)
    if (slice && slice.length > 0) {
      slice.forEach((slice: any) => {
        if (slice?.markAsInvalidated) {
          slice.markAsInvalidated(invalidatedBy)
        }
      })
    }
  }

  /**
   * Mark a section as valid WITHOUT invalidating dependent sections
   * Use this in edit mode when you want to keep the section valid
   * but let smart invalidation logic decide about dependents
   */
  markSectionAsValid(section: StepKeys) {
    const slices = this.getStoreSliceForSection(section)
    if (slices && slices.length > 0) {
      slices.forEach((slice: any) => {
        if (slice?.markAsValid) {
          slice.markAsValid()
        }
      })
    }
  }

  /**
   * Get validation status for a section
   */
  getSectionValidation(section: StepKeys) {
    const slice = this.getStoreSliceForSection(section)
    if (slice && slice.length > 0) {
      return slice.map((slice: any) => slice?.validation || { status: 'not-configured' })
    }
    return { status: 'not-configured' }
  }

  /**
   * Reset all validation states
   */
  resetAllValidations() {
    Object.values(StepKeys).forEach((section) => {
      const slice = this.getStoreSliceForSection(section as StepKeys)
      if (slice && slice.length > 0) {
        slice.forEach((slice: any) => {
          if (slice?.resetValidation) {
            slice.resetValidation()
          }
        })
      }
    })
  }

  /**
   * Private helper to find dependent sections from dependency graph
   */
  private findDependentSections(section: StepKeys): StepKeys[] {
    const sectionMapping = this.getSectionNodeMapping()
    const nodeId = sectionMapping[section]

    if (!nodeId) return []

    const node = this.dependencyGraph.nodes[nodeId]
    if (!node) return []

    // Map node dependents back to section keys
    return node.dependents
      .map((dependentNodeId) => this.getNodeSectionMapping()[dependentNodeId])
      .filter(Boolean) as StepKeys[]
  }

  /**
   * Map sections to store slices
   */
  private getStoreSliceForSection(section: StepKeys) {
    const mapping = {
      [StepKeys.KAFKA_CONNECTION]: [this.store.kafkaStore],
      [StepKeys.TOPIC_SELECTION_1]: [this.store.topicsStore],
      [StepKeys.TOPIC_SELECTION_2]: [this.store.topicsStore],
      [StepKeys.KAFKA_TYPE_VERIFICATION]: [this.store.topicsStore], // Uses topics store for field types
      [StepKeys.DEDUPLICATION_CONFIGURATOR]: [this.store.deduplicationStore],
      [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1]: [this.store.deduplicationStore, this.store.topicsStore],
      [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2]: [this.store.deduplicationStore, this.store.topicsStore],
      [StepKeys.FILTER_CONFIGURATOR]: [this.store.filterStore],
      [StepKeys.TRANSFORMATION_CONFIGURATOR]: [this.store.transformationStore],
      [StepKeys.JOIN_CONFIGURATOR]: [this.store.joinStore],
      [StepKeys.CLICKHOUSE_CONNECTION]: [this.store.clickhouseConnectionStore],
      [StepKeys.CLICKHOUSE_MAPPER]: [this.store.clickhouseDestinationStore],
      [StepKeys.REVIEW_CONFIGURATION]: [this.store.coreStore], // Review uses config store
      [StepKeys.DEPLOY_PIPELINE]: [this.store.coreStore], // Deploy uses config store
    }

    return mapping[section as keyof typeof mapping]
  }

  /**
   * Map StepKeys to dependency graph node IDs
   */
  private getSectionNodeMapping(): Record<StepKeys, string> {
    return {
      [StepKeys.KAFKA_CONNECTION]: 'kafka-connection',
      [StepKeys.TOPIC_SELECTION_1]: 'topic-selection',
      [StepKeys.TOPIC_SELECTION_2]: 'topic-selection',
      [StepKeys.KAFKA_TYPE_VERIFICATION]: 'kafka-type-verification',
      [StepKeys.DEDUPLICATION_CONFIGURATOR]: 'deduplication-configurator',
      [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1]: 'deduplication-configurator',
      [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2]: 'deduplication-configurator',
      [StepKeys.FILTER_CONFIGURATOR]: 'filter-configurator',
      [StepKeys.TRANSFORMATION_CONFIGURATOR]: 'transformation-configurator',
      [StepKeys.JOIN_CONFIGURATOR]: 'join-configurator',
      [StepKeys.CLICKHOUSE_CONNECTION]: 'clickhouse-connection',
      [StepKeys.CLICKHOUSE_MAPPER]: 'clickhouse-mapper',
      [StepKeys.REVIEW_CONFIGURATION]: 'review-configuration',
      [StepKeys.DEPLOY_PIPELINE]: 'deploy-pipeline',
    }
  }

  /**
   * Map dependency graph node IDs back to StepKeys
   */
  private getNodeSectionMapping(): Record<string, StepKeys> {
    return {
      'kafka-connection': StepKeys.KAFKA_CONNECTION,
      'topic-selection': StepKeys.TOPIC_SELECTION_1, // Default to first topic selection
      'kafka-type-verification': StepKeys.KAFKA_TYPE_VERIFICATION,
      'deduplication-configurator': StepKeys.DEDUPLICATION_CONFIGURATOR,
      'filter-configurator': StepKeys.FILTER_CONFIGURATOR,
      'transformation-configurator': StepKeys.TRANSFORMATION_CONFIGURATOR,
      'join-configurator': StepKeys.JOIN_CONFIGURATOR,
      'clickhouse-connection': StepKeys.CLICKHOUSE_CONNECTION,
      'clickhouse-mapper': StepKeys.CLICKHOUSE_MAPPER,
    }
  }
}

/**
 * React hook to use the validation engine
 */
import { useStore } from '../index'

export const useValidationEngine = () => {
  const store = useStore()

  // Create engine instance with access to all stores
  const engine = new DistributedValidationEngine(store)

  return engine
}
