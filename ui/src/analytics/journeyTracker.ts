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

export const trackGeneral = {
  consentGiven: (properties?: Record<string, unknown>) => trackEvent('Consent_Given', properties),

  consentNotGiven: (properties?: Record<string, unknown>) => trackEvent('Consent_NotGiven', properties),

  feedbackSubmitted: (properties?: Record<string, unknown>) => trackEvent('Feedback_Submitted', properties),
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
 * Join Configuration
 */
export const trackJoin = {
  configurationStarted: (properties?: Record<string, unknown>) => trackEvent('JoinConfiguration_Started', properties),

  fieldChanged: (properties?: Record<string, unknown>) => trackEvent('JoinConfiguration_FieldChanged', properties),

  streamConfigured: (properties?: Record<string, unknown>) =>
    trackEvent('JoinConfiguration_StreamConfigured', properties),

  configurationCompleted: (properties?: Record<string, unknown>) =>
    trackEvent('JoinConfiguration_Completed', properties),

  validationFailed: (properties?: Record<string, unknown>) =>
    trackEvent('JoinConfiguration_ValidationFailed', properties),
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
 * Pipeline Management
 */
export const trackPipeline = {
  // Pause Operations
  pauseClicked: (properties?: Record<string, unknown>) => trackEvent('PipelinePause_Clicked', properties),
  pauseFailed: (properties?: Record<string, unknown>) => trackEvent('PipelinePause_Failed', properties),
  pauseSuccess: (properties?: Record<string, unknown>) => trackEvent('PipelinePause_Success', properties),

  // Resume Operations
  resumeClicked: (properties?: Record<string, unknown>) => trackEvent('PipelineResume_Clicked', properties),
  resumeFailed: (properties?: Record<string, unknown>) => trackEvent('PipelineResume_Failed', properties),
  resumeSuccess: (properties?: Record<string, unknown>) => trackEvent('PipelineResume_Success', properties),

  // Rename Operations
  renameClicked: (properties?: Record<string, unknown>) => trackEvent('PipelineRename_Clicked', properties),
  renameFailed: (properties?: Record<string, unknown>) => trackEvent('PipelineRename_Failed', properties),
  renameSuccess: (properties?: Record<string, unknown>) => trackEvent('PipelineRename_Success', properties),

  // Edit Operations
  editClicked: (properties?: Record<string, unknown>) => trackEvent('PipelineEdit_Clicked', properties),
  editFailed: (properties?: Record<string, unknown>) => trackEvent('PipelineEdit_Failed', properties),
  editSuccess: (properties?: Record<string, unknown>) => trackEvent('PipelineEdit_Success', properties),

  // Delete Operations
  deleteClicked: (properties?: Record<string, unknown>) => trackEvent('PipelineDelete_Clicked', properties),
  deleteFailed: (properties?: Record<string, unknown>) => trackEvent('PipelineDelete_Failed', properties),
  deleteSuccess: (properties?: Record<string, unknown>) => trackEvent('PipelineDelete_Success', properties),

  // Legacy Operations (deprecated but kept for compatibility)
  modifyClicked: (properties?: Record<string, unknown>) => trackEvent('PipelineModify_Clicked', properties),
  modifyFailed: (properties?: Record<string, unknown>) => trackEvent('PipelineModify_Failed', properties),
  modifySuccess: (properties?: Record<string, unknown>) => trackEvent('PipelineModify_Success', properties),

  // Pipeline Status Events
  existingPipeline: (properties?: Record<string, unknown>) => trackEvent('Pipeline_ExistingPipeline', properties),
  existingSamePipeline: (properties?: Record<string, unknown>) =>
    trackEvent('Pipeline_ExistingSamePipeline', properties),
}

// Convenient helper to track all journey events
/**
 * Mode Entry Events
 */
export const trackMode = {
  createEntered: (properties?: Record<string, unknown>) => trackEvent('Mode_CreateEntered', properties),

  editEntered: (properties?: Record<string, unknown>) => trackEvent('Mode_EditEntered', properties),

  viewEntered: (properties?: Record<string, unknown>) => trackEvent('Mode_ViewEntered', properties),
}

export const trackJourney = {
  page: trackPage,
  general: trackGeneral,
  operation: trackOperation,
  kafka: trackKafka,
  topic: trackTopic,
  key: trackKey,
  join: trackJoin,
  clickhouse: trackClickhouse,
  destination: trackDestination,
  deploy: trackDeploy,
  pipeline: trackPipeline,
  mode: trackMode,
}
