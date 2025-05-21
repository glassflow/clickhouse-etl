import { track } from './eventManager'
import { dictionary } from './eventDictionary'

/**
 * Helper function to track any journey event with properties
 */
const trackEvent = (eventKey: keyof typeof dictionary, properties?: Record<string, unknown>) => {
  const event = dictionary[eventKey]
  if (!event) {
    console.warn(`Event with key ${eventKey} not found in dictionary`)
    return
  }

  track({
    event,
    context: event.name,
    properties,
  })
}

/**
 * Pages
 */
export const trackPage = {
  homepage: (properties?: Record<string, unknown>) => trackEvent('P0_Homepage', properties),

  setupKafkaConnection: (properties?: Record<string, unknown>) => trackEvent('P1_SetupKafkaConnection', properties),

  selectTopic: (properties?: Record<string, unknown>) => trackEvent('P2_SelectTopic', properties),

  selectLeftTopic: (properties?: Record<string, unknown>) => trackEvent('P2_SelectLeftTopic', properties),

  selectRightTopic: (properties?: Record<string, unknown>) => trackEvent('P2_1_SelectRightTopic', properties),

  deduplicationKey: (properties?: Record<string, unknown>) => trackEvent('P3_DeduplicationKey', properties),

  topicDeduplication: (properties?: Record<string, unknown>) => trackEvent('P3_TopicDeduplication', properties),

  joinKey: (properties?: Record<string, unknown>) => trackEvent('P3_JoinKey', properties),

  setupClickhouseConnection: (properties?: Record<string, unknown>) =>
    trackEvent('P4_SetupClickhouseConnection', properties),

  selectDestination: (properties?: Record<string, unknown>) => trackEvent('P5_SelectDestination', properties),

  pipelines: (properties?: Record<string, unknown>) => trackEvent('P6_Pipelines', properties),
}

/**
 * Operation Selection
 */
export const trackOperation = {
  deduplication: (properties?: Record<string, unknown>) => trackEvent('Deduplication_Clicked', properties),

  join: (properties?: Record<string, unknown>) => trackEvent('Join_Clicked', properties),

  dedupAndJoin: (properties?: Record<string, unknown>) => trackEvent('DedupAndJoin_Clicked', properties),

  ingestOnly: (properties?: Record<string, unknown>) => trackEvent('IngestOnly_Clicked', properties),
}

/**
 * Kafka Connection
 */
export const trackKafka = {
  started: (properties?: Record<string, unknown>) => trackEvent('KafkaConnection_Started', properties),

  failed: (properties?: Record<string, unknown>) => trackEvent('KafkaConnection_Failed', properties),

  success: (properties?: Record<string, unknown>) => trackEvent('KafkaConnection_Success', properties),
}

/**
 * Topic Selection
 */
export const trackTopic = {
  selected: (properties?: Record<string, unknown>) => trackEvent('TopicSelected', properties),

  eventReceived: (properties?: Record<string, unknown>) => trackEvent('TopicSelected_EventReceived', properties),

  noEvent: (properties?: Record<string, unknown>) => trackEvent('TopicSelected_NoEvent', properties),

  eventError: (properties?: Record<string, unknown>) => trackEvent('TopicSelected_EventError', properties),
}

/**
 * Key Selection
 */
export const trackKey = {
  dedupKey: (properties?: Record<string, unknown>) => trackEvent('DedupKeySelected', properties),

  leftJoinKey: (properties?: Record<string, unknown>) => trackEvent('LeftJoinKeySelected', properties),

  rightJoinKey: (properties?: Record<string, unknown>) => trackEvent('RightJoinKeySelected', properties),
}

/**
 * Clickhouse Connection
 */
export const trackClickhouse = {
  started: (properties?: Record<string, unknown>) => trackEvent('ClickhouseConnection_Started', properties),

  failed: (properties?: Record<string, unknown>) => trackEvent('ClickhouseConnection_Failed', properties),

  success: (properties?: Record<string, unknown>) => trackEvent('ClickhouseConnection_Success', properties),
}

/**
 * Destination Selection
 */
export const trackDestination = {
  databaseSelected: (properties?: Record<string, unknown>) => trackEvent('Destination_DatabaseSelected', properties),

  tableSelected: (properties?: Record<string, unknown>) => trackEvent('Destination_TableSelected', properties),

  columnsShowed: (properties?: Record<string, unknown>) => trackEvent('Destination_ColumnsShowed', properties),

  columnsSelected: (properties?: Record<string, unknown>) => trackEvent('Destination_ColumnsSelected', properties),

  databasesFetched: (properties?: Record<string, unknown>) => trackEvent('Destination_DatabasesFetched', properties),

  tablesFetched: (properties?: Record<string, unknown>) => trackEvent('Destination_TablesFetched', properties),

  mappingCompleted: (properties?: Record<string, unknown>) => trackEvent('Destination_MappingCompleted', properties),

  databaseFetchedError: (properties?: Record<string, unknown>) =>
    trackEvent('Destination_DatabaseFetchedError', properties),

  tableFetchedError: (properties?: Record<string, unknown>) => trackEvent('Destination_TableFetchedError', properties),
}

/**
 * Deploy
 */
export const trackDeploy = {
  clicked: (properties?: Record<string, unknown>) => trackEvent('Deploy_Clicked', properties),

  failed: (properties?: Record<string, unknown>) => trackEvent('Deploy_Failed', properties),

  success: (properties?: Record<string, unknown>) => trackEvent('Deploy_Success', properties),
}

/**
 * Pipeline Modification
 */
export const trackPipeline = {
  modifyClicked: (properties?: Record<string, unknown>) => trackEvent('PipelineModify_Clicked', properties),

  modifyFailed: (properties?: Record<string, unknown>) => trackEvent('PipelineModify_Failed', properties),

  modifySuccess: (properties?: Record<string, unknown>) => trackEvent('PipelineModify_Success', properties),

  deleteClicked: (properties?: Record<string, unknown>) => trackEvent('PipelineDelete_Clicked', properties),

  deleteFailed: (properties?: Record<string, unknown>) => trackEvent('PipelineDelete_Failed', properties),

  deleteSuccess: (properties?: Record<string, unknown>) => trackEvent('PipelineDelete_Success', properties),

  existingPipeline: (properties?: Record<string, unknown>) => trackEvent('Pipeline_ExistingPipeline', properties),

  alreadyRunning: (properties?: Record<string, unknown>) => trackEvent('Pipeline_AlreadyRunning', properties),

  noPipeline_Deploying: (properties?: Record<string, unknown>) =>
    trackEvent('Pipeline_NoPipeline_Deploying', properties),

  noPipeline_NoConfig: (properties?: Record<string, unknown>) => trackEvent('Pipeline_NoPipeline_NoConfig', properties),

  noValidConfig: (properties?: Record<string, unknown>) => trackEvent('Pipeline_NoValidConfig', properties),
}

// Convenient helper to track all journey events
export const trackJourney = {
  page: trackPage,
  operation: trackOperation,
  kafka: trackKafka,
  topic: trackTopic,
  key: trackKey,
  clickhouse: trackClickhouse,
  destination: trackDestination,
  deploy: trackDeploy,
  pipeline: trackPipeline,
}
