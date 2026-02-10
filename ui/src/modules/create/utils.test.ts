import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StepKeys } from '@/src/config/constants'
import {
  getWizardJourneyInstances,
  getSingleTopicJourney,
  getTwoTopicJourney,
  getSingleTopicJourneyInstances,
  getTwoTopicJourneyInstances,
  getSidebarStepsFromInstances,
  getWizardJourneySteps,
  type StepInstance,
} from './utils'

vi.mock('@/src/config/feature-flags', () => ({
  isPreviewModeEnabled: vi.fn(() => true),
  isFiltersEnabled: vi.fn(() => true),
  isTransformationsEnabled: vi.fn(() => true),
}))

describe('create/utils', () => {
  describe('getWizardJourneyInstances', () => {
    it('returns empty array for topicCount 0, undefined, or > 2', () => {
      expect(getWizardJourneyInstances(0)).toEqual([])
      expect(getWizardJourneyInstances(undefined)).toEqual([])
      expect(getWizardJourneyInstances(3)).toEqual([])
    })

    it('returns single-topic journey instances for topicCount 1', () => {
      const instances = getWizardJourneyInstances(1)
      expect(instances.length).toBeGreaterThan(0)
      expect(instances[0].key).toBe(StepKeys.KAFKA_CONNECTION)
      expect(instances[0].id).toBeDefined()
      const keys = instances.map((i) => i.key)
      expect(keys).toContain(StepKeys.KAFKA_CONNECTION)
      expect(keys).toContain(StepKeys.TOPIC_SELECTION_1)
      expect(keys).toContain(StepKeys.KAFKA_TYPE_VERIFICATION)
      expect(keys).toContain(StepKeys.DEDUPLICATION_CONFIGURATOR)
      expect(keys).toContain(StepKeys.CLICKHOUSE_CONNECTION)
      expect(keys).toContain(StepKeys.CLICKHOUSE_MAPPER)
    })

    it('returns two-topic journey instances for topicCount 2', () => {
      const instances = getWizardJourneyInstances(2)
      expect(instances.length).toBeGreaterThan(0)
      expect(instances[0].key).toBe(StepKeys.KAFKA_CONNECTION)
      const keys = instances.map((i) => i.key)
      expect(keys).toContain(StepKeys.TOPIC_SELECTION_2)
      expect(keys).toContain(StepKeys.JOIN_CONFIGURATOR)
    })
  })

  describe('getSingleTopicJourney', () => {
    it('returns ordered step keys including Kafka, Topic, Type Verification, Dedup, ClickHouse, Mapper', () => {
      const journey = getSingleTopicJourney()
      expect(journey[0]).toBe(StepKeys.KAFKA_CONNECTION)
      expect(journey).toContain(StepKeys.TOPIC_SELECTION_1)
      expect(journey).toContain(StepKeys.KAFKA_TYPE_VERIFICATION)
      expect(journey).toContain(StepKeys.DEDUPLICATION_CONFIGURATOR)
      expect(journey).toContain(StepKeys.CLICKHOUSE_CONNECTION)
      expect(journey).toContain(StepKeys.CLICKHOUSE_MAPPER)
    })

    it('includes REVIEW_CONFIGURATION when preview mode is enabled (default mock)', () => {
      const journey = getSingleTopicJourney()
      expect(journey).toContain(StepKeys.REVIEW_CONFIGURATION)
    })

    it('includes FILTER_CONFIGURATOR and TRANSFORMATION_CONFIGURATOR when flags enabled (default mock)', () => {
      const journey = getSingleTopicJourney()
      expect(journey).toContain(StepKeys.FILTER_CONFIGURATOR)
      expect(journey).toContain(StepKeys.TRANSFORMATION_CONFIGURATOR)
    })
  })

  describe('getTwoTopicJourney', () => {
    it('returns ordered step keys with Topic 1, Type Verification, Dedup, Topic 2, Type Verification, Dedup, Join', () => {
      const journey = getTwoTopicJourney()
      expect(journey[0]).toBe(StepKeys.KAFKA_CONNECTION)
      expect(journey).toContain(StepKeys.TOPIC_SELECTION_1)
      expect(journey).toContain(StepKeys.TOPIC_SELECTION_2)
      expect(journey).toContain(StepKeys.JOIN_CONFIGURATOR)
      expect(journey.filter((k) => k === StepKeys.KAFKA_TYPE_VERIFICATION)).toHaveLength(2)
      expect(journey.filter((k) => k === StepKeys.DEDUPLICATION_CONFIGURATOR)).toHaveLength(2)
    })

    it('does not include FILTER_CONFIGURATOR for two-topic journey', () => {
      const journey = getTwoTopicJourney()
      expect(journey).not.toContain(StepKeys.FILTER_CONFIGURATOR)
    })
  })

  describe('getSingleTopicJourneyInstances', () => {
    it('returns instances with stable unique ids and topicIndex where needed', () => {
      const instances = getSingleTopicJourneyInstances()
      const ids = new Set(instances.map((i) => i.id))
      expect(ids.size).toBe(instances.length)

      const dedup = instances.find((i) => i.key === StepKeys.DEDUPLICATION_CONFIGURATOR)
      expect(dedup?.topicIndex).toBe(0)
      const typeVerif = instances.find((i) => i.key === StepKeys.KAFKA_TYPE_VERIFICATION)
      expect(typeVerif?.topicIndex).toBe(0)
    })

    it('uses id format key-topicIndex for steps that need topicIndex', () => {
      const instances = getSingleTopicJourneyInstances()
      const dedup = instances.find((i) => i.key === StepKeys.DEDUPLICATION_CONFIGURATOR)
      expect(dedup?.id).toMatch(/^deduplication-configurator-\d+$/)
    })
  })

  describe('getTwoTopicJourneyInstances', () => {
    it('returns instances with topicIndex 0 before TOPIC_SELECTION_2 and 1 after', () => {
      const instances = getTwoTopicJourneyInstances()
      const topic2Index = instances.findIndex((i) => i.key === StepKeys.TOPIC_SELECTION_2)
      const typeVerifIndices = instances
        .map((i, idx) => (i.key === StepKeys.KAFKA_TYPE_VERIFICATION ? idx : -1))
        .filter((idx) => idx >= 0)
      expect(typeVerifIndices.length).toBe(2)
      expect(instances[typeVerifIndices[0]].topicIndex).toBe(0)
      expect(instances[typeVerifIndices[1]].topicIndex).toBe(1)
    })
  })

  describe('getSidebarStepsFromInstances', () => {
    it('returns main steps and substeps for single-topic journey', () => {
      const journey = getSingleTopicJourneyInstances()
      const sidebar = getSidebarStepsFromInstances(journey, 1)
      expect(sidebar.length).toBeGreaterThan(0)
      const mainSteps = sidebar.filter((s) => !s.parent)
      const substeps = sidebar.filter((s) => s.parent != null)
      expect(mainSteps.length).toBeGreaterThan(0)
      expect(substeps.length).toBeGreaterThan(0)
    })

    it('uses "Select Left Topic" for TOPIC_SELECTION_1 when topicCount is 2', () => {
      const journey = getTwoTopicJourneyInstances()
      const sidebar = getSidebarStepsFromInstances(journey, 2)
      const leftTopic = sidebar.find((s) => s.key === StepKeys.TOPIC_SELECTION_1 && s.title === 'Select Left Topic')
      expect(leftTopic).toBeDefined()
    })

    it('uses "Verify Left Topic Types" and "Verify Right Topic Types" for two-topic journey', () => {
      const journey = getTwoTopicJourneyInstances()
      const sidebar = getSidebarStepsFromInstances(journey, 2)
      const leftVerify = sidebar.find((s) => s.title === 'Verify Left Topic Types')
      const rightVerify = sidebar.find((s) => s.title === 'Verify Right Topic Types')
      expect(leftVerify).toBeDefined()
      expect(rightVerify).toBeDefined()
    })

    it('every sidebar step has id, key, and title', () => {
      const journey = getSingleTopicJourneyInstances()
      const sidebar = getSidebarStepsFromInstances(journey, 1)
      sidebar.forEach((s) => {
        expect(s.id).toBeDefined()
        expect(s.key).toBeDefined()
        expect(s.title).toBeDefined()
      })
    })
  })

  describe('getWizardJourneySteps', () => {
    it('returns empty object for topicCount 0, undefined, or > 2', () => {
      expect(getWizardJourneySteps(0)).toEqual({})
      expect(getWizardJourneySteps(undefined)).toEqual({})
      expect(getWizardJourneySteps(3)).toEqual({})
    })

    it('returns component map for topicCount 1 with keys from single-topic journey', () => {
      const map = getWizardJourneySteps(1)
      const journey = getSingleTopicJourney()
      journey.forEach((key) => {
        expect(map[key]).toBeDefined()
        expect(typeof map[key]).toBe('function')
      })
    })

    it('returns component map for topicCount 2 with keys from two-topic journey', () => {
      const map = getWizardJourneySteps(2)
      const journey = getTwoTopicJourney()
      journey.forEach((key) => {
        expect(map[key]).toBeDefined()
        expect(typeof map[key]).toBe('function')
      })
    })
  })
})
