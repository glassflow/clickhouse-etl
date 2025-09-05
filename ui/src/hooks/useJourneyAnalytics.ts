import { useStore } from '@/src/store'
import { useCallback, useMemo } from 'react'
import { isAnalyticsEnabled } from '@/src/utils/common.client'
import {
  trackPage,
  trackOperation,
  trackKafka,
  trackTopic,
  trackKey,
  trackJoin,
  trackClickhouse,
  trackDestination,
  trackDeploy,
  trackPipeline,
  trackGeneral,
  trackMode,
} from '@/src/analytics'

// Add a simple memoization cache to prevent duplicate calls
const trackingCache = new Map<string, number>()
const TRACKING_CACHE_TTL = 2000 // 2 seconds

/**
 * Hook to easily track journey analytics events throughout the application
 */
export function useJourneyAnalytics() {
  const { coreStore } = useStore()
  const { mode: currentMode, pipelineId, pipelineName } = coreStore

  /**
   * Helper function to get base context for all analytics events
   * Automatically injects mode, pipeline info, and common context
   */
  const getBaseContext = useCallback(
    () => ({
      mode: currentMode, // 'create' | 'edit' | 'view'
      pipelineId: pipelineId || null, // null for create mode
      pipelineName: pipelineName || null,
      isReadOnly: currentMode === 'view',
      timestamp: new Date().toISOString(),
    }),
    [currentMode, pipelineId, pipelineName],
  )

  /**
   * Helper function to track an event with caching to prevent duplicates
   * Automatically merges base context (mode, pipeline info) with provided properties
   */
  const trackWithCache = useCallback(
    (
      eventName: string,
      trackingFunction: (enhancedProperties: Record<string, unknown>) => void,
      properties?: Record<string, unknown>,
    ) => {
      // Only track if analytics is enabled via environment variable or override is set
      const { overrideTrackingConsent } = properties || {}

      if (!isAnalyticsEnabled() && !overrideTrackingConsent) {
        // NOTE: uncomment this if you want to see the analytics disabled logs
        // console.log('Analytics disabled via environment variable, not tracking:', {
        //   eventName,
        //   properties,
        // })
        return
      }

      // Merge base context with provided properties
      const enhancedProperties = {
        ...getBaseContext(),
        ...properties,
      }

      // Create a cache key based on event and properties (excluding timestamp for caching)
      const { timestamp, ...cacheableProps } = enhancedProperties
      const cacheKey = `${eventName}:${JSON.stringify(cacheableProps)}`
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

        // Execute the tracking function with enhanced properties
        trackingFunction(enhancedProperties)
      }
    },
    [getBaseContext],
  )

  const general = useMemo(
    () => ({
      consentGiven: (properties?: Record<string, unknown>) =>
        trackWithCache('Consent_Given', (enhancedProps) => trackGeneral.consentGiven(enhancedProps), properties),

      consentNotGiven: (properties?: Record<string, unknown>) =>
        trackWithCache('Consent_NotGiven', (enhancedProps) => trackGeneral.consentNotGiven(enhancedProps), properties),

      feedbackSubmitted: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Feedback_Submitted',
          (enhancedProps) => trackGeneral.feedbackSubmitted(enhancedProps),
          properties,
        ),
    }),
    [trackWithCache],
  )

  // NOTE: Page tracking - all events tracked
  const page = useMemo(
    () => ({
      homepage: (properties?: Record<string, unknown>) =>
        trackWithCache('P0_Homepage', (enhancedProps) => trackPage.homepage(enhancedProps), properties),

      setupKafkaConnection: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'P1_SetupKafkaConnection',
          (enhancedProps) => trackPage.setupKafkaConnection(enhancedProps),
          properties,
        ),

      selectTopic: (properties?: Record<string, unknown>) =>
        trackWithCache('P2_SelectTopic', (enhancedProps) => trackPage.selectTopic(enhancedProps), properties),

      selectLeftTopic: (properties?: Record<string, unknown>) =>
        trackWithCache('P2_SelectLeftTopic', (enhancedProps) => trackPage.selectLeftTopic(enhancedProps), properties),

      selectRightTopic: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'P2_1_SelectRightTopic',
          (enhancedProps) => trackPage.selectRightTopic(enhancedProps),
          properties,
        ),

      deduplicationKey: (properties?: Record<string, unknown>) =>
        trackWithCache('P3_DeduplicationKey', (enhancedProps) => trackPage.deduplicationKey(enhancedProps), properties),

      // this was legacy deduplication page view, now we have a new deduplication page view
      topicDeduplication: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'P3_TopicDeduplication',
          (enhancedProps) => trackPage.topicDeduplication(enhancedProps),
          properties,
        ),

      joinKey: (properties?: Record<string, unknown>) =>
        trackWithCache('P3_JoinKey', (enhancedProps) => trackPage.joinKey(enhancedProps), properties),

      setupClickhouseConnection: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'P4_SetupClickhouseConnection',
          (enhancedProps) => trackPage.setupClickhouseConnection(enhancedProps),
          properties,
        ),

      selectDestination: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'P5_SelectDestination',
          (enhancedProps) => trackPage.selectDestination(enhancedProps),
          properties,
        ),

      pipelines: (properties?: Record<string, unknown>) =>
        trackWithCache('P6_Pipelines', (enhancedProps) => trackPage.pipelines(enhancedProps), properties),
    }),
    [trackWithCache],
  )

  // NOTE: Operation tracking - all events tracked
  const operation = useMemo(
    () => ({
      deduplication: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Deduplication_Clicked',
          (enhancedProps) => trackOperation.deduplication(enhancedProps),
          properties,
        ),

      join: (properties?: Record<string, unknown>) =>
        trackWithCache('Join_Clicked', (enhancedProps) => trackOperation.join(enhancedProps), properties),

      dedupAndJoin: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'DedupAndJoin_Clicked',
          (enhancedProps) => trackOperation.dedupAndJoin(enhancedProps),
          properties,
        ),

      ingestOnly: (properties?: Record<string, unknown>) =>
        trackWithCache('IngestOnly_Clicked', (enhancedProps) => trackOperation.ingestOnly(enhancedProps), properties),
    }),
    [trackWithCache],
  )

  // NOTE: Kafka connection tracking - all events tracked
  const kafka = useMemo(
    () => ({
      started: (properties?: Record<string, unknown>) =>
        trackWithCache('KafkaConnection_Started', (enhancedProps) => trackKafka.started(enhancedProps), properties),

      failed: (properties?: Record<string, unknown>) =>
        trackWithCache('KafkaConnection_Failed', (enhancedProps) => trackKafka.failed(enhancedProps), properties),

      success: (properties?: Record<string, unknown>) =>
        trackWithCache('KafkaConnection_Success', (enhancedProps) => trackKafka.success(enhancedProps), properties),
    }),
    [trackWithCache],
  )

  // NOTE: Topic selection tracking - all events tracked
  const topic = useMemo(
    () => ({
      selected: (properties?: Record<string, unknown>) =>
        trackWithCache('TopicSelected', (enhancedProps) => trackTopic.selected(enhancedProps), properties),

      eventReceived: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'TopicSelected_EventReceived',
          (enhancedProps) => trackTopic.eventReceived(enhancedProps),
          properties,
        ),

      noEvent: (properties?: Record<string, unknown>) =>
        trackWithCache('TopicSelected_NoEvent', (enhancedProps) => trackTopic.noEvent(enhancedProps), properties),

      eventError: (properties?: Record<string, unknown>) =>
        trackWithCache('TopicSelected_EventError', (enhancedProps) => trackTopic.eventError(enhancedProps), properties),
    }),
    [trackWithCache],
  )

  // NOTE: Key selection tracking - all events tracked
  const key = useMemo(
    () => ({
      dedupKey: (properties?: Record<string, unknown>) =>
        trackWithCache('DedupKeySelected', (enhancedProps) => trackKey.dedupKey(enhancedProps), properties),

      leftJoinKey: (properties?: Record<string, unknown>) =>
        trackWithCache('LeftJoinKeySelected', (enhancedProps) => trackKey.leftJoinKey(enhancedProps), properties),

      rightJoinKey: (properties?: Record<string, unknown>) =>
        trackWithCache('RightJoinKeySelected', (enhancedProps) => trackKey.rightJoinKey(enhancedProps), properties),
    }),
    [trackWithCache],
  )

  // NOTE: Join configuration tracking - all events tracked
  const join = useMemo(
    () => ({
      configurationStarted: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'JoinConfiguration_Started',
          (enhancedProps) => trackJoin.configurationStarted(enhancedProps),
          properties,
        ),

      fieldChanged: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'JoinConfiguration_FieldChanged',
          (enhancedProps) => trackJoin.fieldChanged(enhancedProps),
          properties,
        ),

      streamConfigured: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'JoinConfiguration_StreamConfigured',
          (enhancedProps) => trackJoin.streamConfigured(enhancedProps),
          properties,
        ),

      configurationCompleted: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'JoinConfiguration_Completed',
          (enhancedProps) => trackJoin.configurationCompleted(enhancedProps),
          properties,
        ),

      validationFailed: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'JoinConfiguration_ValidationFailed',
          (enhancedProps) => trackJoin.validationFailed(enhancedProps),
          properties,
        ),
    }),
    [trackWithCache],
  )

  // NOTE: Clickhouse connection tracking - all events tracked
  const clickhouse = useMemo(
    () => ({
      started: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'ClickhouseConnection_Started',
          (enhancedProps) => trackClickhouse.started(enhancedProps),
          properties,
        ),

      failed: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'ClickhouseConnection_Failed',
          (enhancedProps) => trackClickhouse.failed(enhancedProps),
          properties,
        ),

      success: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'ClickhouseConnection_Success',
          (enhancedProps) => trackClickhouse.success(enhancedProps),
          properties,
        ),
    }),
    [trackWithCache],
  )

  // NOTE: Destination selection tracking - all events tracked
  const destination = useMemo(
    () => ({
      databaseSelected: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Destination_DatabaseSelected',
          (enhancedProps) => trackDestination.databaseSelected(enhancedProps),
          properties,
        ),

      tableSelected: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Destination_TableSelected',
          (enhancedProps) => trackDestination.tableSelected(enhancedProps),
          properties,
        ),

      columnsShowed: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Destination_ColumnsShowed',
          (enhancedProps) => trackDestination.columnsShowed(enhancedProps),
          properties,
        ),

      columnsSelected: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Destination_ColumnsSelected',
          (enhancedProps) => trackDestination.columnsSelected(enhancedProps),
          properties,
        ),

      databasesFetched: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Destination_DatabasesFetched',
          (enhancedProps) => trackDestination.databasesFetched(enhancedProps),
          properties,
        ),

      tablesFetched: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Destination_TablesFetched',
          (enhancedProps) => trackDestination.tablesFetched(enhancedProps),
          properties,
        ),

      mappingCompleted: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Destination_MappingCompleted',
          (enhancedProps) => trackDestination.mappingCompleted(enhancedProps),
          properties,
        ),

      databaseFetchedError: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Destination_DatabaseFetchedError',
          (enhancedProps) => trackDestination.databaseFetchedError(enhancedProps),
          properties,
        ),

      tableFetchedError: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Destination_TableFetchedError',
          (enhancedProps) => trackDestination.tableFetchedError(enhancedProps),
          properties,
        ),
    }),
    [trackWithCache],
  )

  // NOTE: Deploy tracking - all events tracked
  const deploy = useMemo(
    () => ({
      clicked: (properties?: Record<string, unknown>) =>
        trackWithCache('Deploy_Clicked', (enhancedProps) => trackDeploy.clicked(enhancedProps), properties),

      failed: (properties?: Record<string, unknown>) =>
        trackWithCache('Deploy_Failed', (enhancedProps) => trackDeploy.failed(enhancedProps), properties),

      success: (properties?: Record<string, unknown>) =>
        trackWithCache('Deploy_Success', (enhancedProps) => trackDeploy.success(enhancedProps), properties),
    }),
    [trackWithCache],
  )

  // NOTE: Pipeline modification tracking - all events tracked
  const pipeline = useMemo(
    () => ({
      // Pause Operations
      pauseClicked: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelinePause_Clicked',
          (enhancedProps) => trackPipeline.pauseClicked(enhancedProps),
          properties,
        ),

      pauseFailed: (properties?: Record<string, unknown>) =>
        trackWithCache('PipelinePause_Failed', (enhancedProps) => trackPipeline.pauseFailed(enhancedProps), properties),

      pauseSuccess: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelinePause_Success',
          (enhancedProps) => trackPipeline.pauseSuccess(enhancedProps),
          properties,
        ),

      // Resume Operations
      resumeClicked: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelineResume_Clicked',
          (enhancedProps) => trackPipeline.resumeClicked(enhancedProps),
          properties,
        ),

      resumeFailed: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelineResume_Failed',
          (enhancedProps) => trackPipeline.resumeFailed(enhancedProps),
          properties,
        ),

      resumeSuccess: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelineResume_Success',
          (enhancedProps) => trackPipeline.resumeSuccess(enhancedProps),
          properties,
        ),

      // Rename Operations
      renameClicked: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelineRename_Clicked',
          (enhancedProps) => trackPipeline.renameClicked(enhancedProps),
          properties,
        ),

      renameFailed: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelineRename_Failed',
          (enhancedProps) => trackPipeline.renameFailed(enhancedProps),
          properties,
        ),

      renameSuccess: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelineRename_Success',
          (enhancedProps) => trackPipeline.renameSuccess(enhancedProps),
          properties,
        ),

      // Edit Operations
      editClicked: (properties?: Record<string, unknown>) =>
        trackWithCache('PipelineEdit_Clicked', (enhancedProps) => trackPipeline.editClicked(enhancedProps), properties),

      editFailed: (properties?: Record<string, unknown>) =>
        trackWithCache('PipelineEdit_Failed', (enhancedProps) => trackPipeline.editFailed(enhancedProps), properties),

      editSuccess: (properties?: Record<string, unknown>) =>
        trackWithCache('PipelineEdit_Success', (enhancedProps) => trackPipeline.editSuccess(enhancedProps), properties),

      // Delete Operations
      deleteClicked: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelineDelete_Clicked',
          (enhancedProps) => trackPipeline.deleteClicked(enhancedProps),
          properties,
        ),

      deleteFailed: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelineDelete_Failed',
          (enhancedProps) => trackPipeline.deleteFailed(enhancedProps),
          properties,
        ),

      deleteSuccess: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelineDelete_Success',
          (enhancedProps) => trackPipeline.deleteSuccess(enhancedProps),
          properties,
        ),

      // Legacy Operations (deprecated but kept for compatibility)
      modifyClicked: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelineModify_Clicked',
          (enhancedProps) => trackPipeline.modifyClicked(enhancedProps),
          properties,
        ),

      modifyFailed: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelineModify_Failed',
          (enhancedProps) => trackPipeline.modifyFailed(enhancedProps),
          properties,
        ),

      modifySuccess: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'PipelineModify_Success',
          (enhancedProps) => trackPipeline.modifySuccess(enhancedProps),
          properties,
        ),

      // Pipeline Status Events
      existingPipeline: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Pipeline_ExistingPipeline',
          (enhancedProps) => trackPipeline.existingPipeline(enhancedProps),
          properties,
        ),

      existingSamePipeline: (properties?: Record<string, unknown>) =>
        trackWithCache(
          'Pipeline_ExistingSamePipeline',
          (enhancedProps) => trackPipeline.existingSamePipeline(enhancedProps),
          properties,
        ),
    }),
    [trackWithCache],
  )

  // NOTE: Mode entry tracking - all events tracked
  const mode = useMemo(
    () => ({
      createEntered: (properties?: Record<string, unknown>) =>
        trackWithCache('Mode_CreateEntered', (enhancedProps) => trackMode.createEntered(enhancedProps), properties),

      editEntered: (properties?: Record<string, unknown>) =>
        trackWithCache('Mode_EditEntered', (enhancedProps) => trackMode.editEntered(enhancedProps), properties),

      viewEntered: (properties?: Record<string, unknown>) =>
        trackWithCache('Mode_ViewEntered', (enhancedProps) => trackMode.viewEntered(enhancedProps), properties),
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
      join,
      clickhouse,
      destination,
      deploy,
      pipeline,
      mode,
      isEnabled: isAnalyticsEnabled(),
      general,
    }),
    [page, operation, kafka, topic, key, join, clickhouse, destination, deploy, pipeline, mode, general],
  )
}
