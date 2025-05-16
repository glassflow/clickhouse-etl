import { useStore } from '@/src/store'
import { useCallback, useMemo } from 'react'
import {
  trackPage,
  trackOperation,
  trackKafka,
  trackTopic,
  trackKey,
  trackClickhouse,
  trackDestination,
  trackDeploy,
  trackPipeline,
} from '@/src/analytics'

// Add a simple memoization cache to prevent duplicate calls
const trackingCache = new Map<string, number>()
const TRACKING_CACHE_TTL = 2000 // 2 seconds

/**
 * Hook to easily track journey analytics events throughout the application
 */
export function useJourneyAnalytics() {
  const { analyticsConsent } = useStore()

  /**
   * Helper function to track an event with caching to prevent duplicates
   */
  const trackWithCache = useCallback(
    (eventName: string, trackingFunction: () => void, properties?: Record<string, unknown>) => {
      // Only track if user has consented
      if (!analyticsConsent) return

      // Create a cache key based on event and properties
      const cacheKey = `${eventName}:${JSON.stringify(properties || {})}`
      const now = Date.now()
      const lastTracked = trackingCache.get(cacheKey) || 0

      // Only track if this event hasn't been tracked recently
      if (now - lastTracked > TRACKING_CACHE_TTL) {
        trackingCache.set(cacheKey, now)

        // Clean up old entries
        if (trackingCache.size > 100) {
          const keysToDelete: string[] = []
          trackingCache.forEach((time, key) => {
            if (now - time > TRACKING_CACHE_TTL * 5) {
              keysToDelete.push(key)
            }
          })
          keysToDelete.forEach((key) => trackingCache.delete(key))
        }

        // Execute the tracking function
        trackingFunction()
      }
    },
    [analyticsConsent],
  )

  // Page tracking
  const page = useMemo(
    () => ({
      homepage: (properties?: Record<string, unknown>) =>
        trackWithCache('P0_Homepage', () => trackPage.homepage(properties), properties),

      setupKafkaConnection: (properties?: Record<string, unknown>) =>
        trackWithCache('P1_SetupKafkaConnection', () => trackPage.setupKafkaConnection(properties), properties),

      selectTopic: (properties?: Record<string, unknown>) =>
        trackWithCache('P2_SelectTopic', () => trackPage.selectTopic(properties), properties),

      selectLeftTopic: (properties?: Record<string, unknown>) =>
        trackWithCache('P2_SelectLeftTopic', () => trackPage.selectLeftTopic(properties), properties),

      selectRightTopic: (properties?: Record<string, unknown>) =>
        trackWithCache('P2_1_SelectRightTopic', () => trackPage.selectRightTopic(properties), properties),

      deduplicationKey: (properties?: Record<string, unknown>) =>
        trackWithCache('P3_DeduplicationKey', () => trackPage.deduplicationKey(properties), properties),

      joinKey: (properties?: Record<string, unknown>) =>
        trackWithCache('P3_JoinKey', () => trackPage.joinKey(properties), properties),

      setupClickhouseConnection: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'P4_SetupClickhouseConnection',
          () => trackPage.setupClickhouseConnection(properties),
          properties,
        ),

      selectDestination: (properties?: Record<string, unknown>) =>
        trackWithCache('P5_SelectDestination', () => trackPage.selectDestination(properties), properties),

      pipelineActive: (properties?: Record<string, unknown>) =>
        trackWithCache('P6_PipelineActive', () => trackPage.pipelineActive(properties), properties),
    }),
    [trackWithCache],
  )

  // Operation tracking
  const operation = useMemo(
    () => ({
      deduplication: (properties?: Record<string, unknown>) =>
        trackWithCache('Deduplication_Clicked', () => trackOperation.deduplication(properties), properties),

      join: (properties?: Record<string, unknown>) =>
        trackWithCache('Join_Clicked', () => trackOperation.join(properties), properties),

      dedupAndJoin: (properties?: Record<string, unknown>) =>
        trackWithCache('DedupAndJoin_Clicked', () => trackOperation.dedupAndJoin(properties), properties),

      ingestOnly: (properties?: Record<string, unknown>) =>
        trackWithCache('IngestOnly_Clicked', () => trackOperation.ingestOnly(properties), properties),
    }),
    [trackWithCache],
  )

  // Kafka connection tracking
  const kafka = useMemo(
    () => ({
      started: (properties?: Record<string, unknown>) =>
        trackWithCache('KafkaConnection_Started', () => trackKafka.started(properties), properties),

      failed: (properties?: Record<string, unknown>) =>
        trackWithCache('KafkaConnection_Failed', () => trackKafka.failed(properties), properties),

      success: (properties?: Record<string, unknown>) =>
        trackWithCache('KafkaConnection_Success', () => trackKafka.success(properties), properties),
    }),
    [trackWithCache],
  )

  // Topic selection tracking
  const topic = useMemo(
    () => ({
      selected: (properties?: Record<string, unknown>) =>
        trackWithCache('TopicSelected', () => trackTopic.selected(properties), properties),

      eventReceived: (properties?: Record<string, unknown>) =>
        trackWithCache('TopicSelected_EventReceived', () => trackTopic.eventReceived(properties), properties),

      noEvent: (properties?: Record<string, unknown>) =>
        trackWithCache('TopicSelected_NoEvent', () => trackTopic.noEvent(properties), properties),

      eventError: (properties?: Record<string, unknown>) =>
        trackWithCache('TopicSelected_EventError', () => trackTopic.eventError(properties), properties),
    }),
    [trackWithCache],
  )

  // Key selection tracking
  const key = useMemo(
    () => ({
      dedupKey: (properties?: Record<string, unknown>) =>
        trackWithCache('DedupKeySelected', () => trackKey.dedupKey(properties), properties),

      leftJoinKey: (properties?: Record<string, unknown>) =>
        trackWithCache('LeftJoinKeySelected', () => trackKey.leftJoinKey(properties), properties),

      rightJoinKey: (properties?: Record<string, unknown>) =>
        trackWithCache('RightJoinKeySelected', () => trackKey.rightJoinKey(properties), properties),
    }),
    [trackWithCache],
  )

  // Clickhouse connection tracking
  const clickhouse = useMemo(
    () => ({
      started: (properties?: Record<string, unknown>) =>
        trackWithCache('ClickhouseConnection_Started', () => trackClickhouse.started(properties), properties),

      failed: (properties?: Record<string, unknown>) =>
        trackWithCache('ClickhouseConnection_Failed', () => trackClickhouse.failed(properties), properties),

      success: (properties?: Record<string, unknown>) =>
        trackWithCache('ClickhouseConnection_Success', () => trackClickhouse.success(properties), properties),
    }),
    [trackWithCache],
  )

  // Destination selection tracking
  const destination = useMemo(
    () => ({
      databaseSelected: (properties?: Record<string, unknown>) =>
        trackWithCache('Destination_DatabaseSelected', () => trackDestination.databaseSelected(properties), properties),

      tableSelected: (properties?: Record<string, unknown>) =>
        trackWithCache('Destination_TableSelected', () => trackDestination.tableSelected(properties), properties),

      columnsShowed: (properties?: Record<string, unknown>) =>
        trackWithCache('Destination_ColumnsShowed', () => trackDestination.columnsShowed(properties), properties),

      columnsSelected: (properties?: Record<string, unknown>) =>
        trackWithCache('Destination_ColumnsSelected', () => trackDestination.columnsSelected(properties), properties),

      databasesFetched: (properties?: Record<string, unknown>) =>
        trackWithCache('Destination_DatabasesFetched', () => trackDestination.databasesFetched(properties), properties),

      tablesFetched: (properties?: Record<string, unknown>) =>
        trackWithCache('Destination_TablesFetched', () => trackDestination.tablesFetched(properties), properties),

      mappingCompleted: (properties?: Record<string, unknown>) =>
        trackWithCache('Destination_MappingCompleted', () => trackDestination.mappingCompleted(properties), properties),

      databaseFetchedError: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Destination_DatabaseFetchedError',
          () => trackDestination.databaseFetchedError(properties),
          properties,
        ),

      tableFetchedError: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Destination_TableFetchedError',
          () => trackDestination.tableFetchedError(properties),
          properties,
        ),
    }),
    [trackWithCache],
  )

  // Deploy tracking
  const deploy = useMemo(
    () => ({
      clicked: (properties?: Record<string, unknown>) =>
        trackWithCache('Deploy_Clicked', () => trackDeploy.clicked(properties), properties),

      failed: (properties?: Record<string, unknown>) =>
        trackWithCache('Deploy_Failed', () => trackDeploy.failed(properties), properties),

      success: (properties?: Record<string, unknown>) =>
        trackWithCache('Deploy_Success', () => trackDeploy.success(properties), properties),
    }),
    [trackWithCache],
  )

  // Pipeline modification tracking
  const pipeline = useMemo(
    () => ({
      modifyClicked: (properties?: Record<string, unknown>) =>
        trackWithCache('PipelineModify_Clicked', () => trackPipeline.modifyClicked(properties), properties),

      modifyFailed: (properties?: Record<string, unknown>) =>
        trackWithCache('PipelineModify_Failed', () => trackPipeline.modifyFailed(properties), properties),

      modifySuccess: (properties?: Record<string, unknown>) =>
        trackWithCache('PipelineModify_Success', () => trackPipeline.modifySuccess(properties), properties),

      deleteClicked: (properties?: Record<string, unknown>) =>
        trackWithCache('PipelineDelete_Clicked', () => trackPipeline.deleteClicked(properties), properties),

      deleteFailed: (properties?: Record<string, unknown>) =>
        trackWithCache('PipelineDelete_Failed', () => trackPipeline.deleteFailed(properties), properties),

      deleteSuccess: (properties?: Record<string, unknown>) =>
        trackWithCache('PipelineDelete_Success', () => trackPipeline.deleteSuccess(properties), properties),
    }),
    [trackWithCache],
  )

  // Return all tracking functions in a memoized object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      page,
      operation,
      kafka,
      topic,
      key,
      clickhouse,
      destination,
      deploy,
      pipeline,
      isEnabled: analyticsConsent,
    }),
    [page, operation, kafka, topic, key, clickhouse, destination, deploy, pipeline, analyticsConsent],
  )
}
