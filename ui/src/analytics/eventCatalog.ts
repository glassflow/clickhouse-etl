import { dictionary } from './eventDictionary'

const eventCatalog: Record<string, boolean> = {
  // Consent Events
  [dictionary.Consent_Given.name]: true,
  [dictionary.Consent_NotGiven.name]: true,
  [dictionary.Feedback_Submitted.name]: true,

  // Journey Page Events
  [dictionary.P0_Homepage.name]: true,
  [dictionary.P1_SetupKafkaConnection.name]: true,
  [dictionary.P2_SelectTopic.name]: true,
  [dictionary.P2_SelectLeftTopic.name]: true,
  [dictionary.P2_1_SelectRightTopic.name]: true,
  [dictionary.P3_DeduplicationKey.name]: true,
  [dictionary.P3_JoinKey.name]: true,
  [dictionary.P3_TopicDeduplication.name]: true,
  [dictionary.P4_SetupClickhouseConnection.name]: true,
  [dictionary.P5_SelectDestination.name]: true,
  [dictionary.P6_Pipelines.name]: true,

  // Operation Selection Events
  [dictionary.Deduplication_Clicked.name]: true,
  [dictionary.Join_Clicked.name]: true,
  [dictionary.DedupAndJoin_Clicked.name]: true,
  [dictionary.IngestOnly_Clicked.name]: true,

  // Kafka Connection Events
  [dictionary.KafkaConnection_Started.name]: true,
  [dictionary.KafkaConnection_Failed.name]: true,
  [dictionary.KafkaConnection_Success.name]: true,

  // Topic Selection Events
  [dictionary.TopicSelected.name]: true,
  [dictionary.TopicSelected_EventReceived.name]: true,
  [dictionary.TopicSelected_NoEvent.name]: true,
  [dictionary.TopicSelected_EventError.name]: true,

  // Key Selection Events
  [dictionary.DedupKeySelected.name]: true,
  [dictionary.LeftJoinKeySelected.name]: true,
  [dictionary.RightJoinKeySelected.name]: true,

  // Join Configuration Events
  [dictionary.JoinConfiguration_Started.name]: true,
  [dictionary.JoinConfiguration_FieldChanged.name]: true,
  [dictionary.JoinConfiguration_StreamConfigured.name]: true,
  [dictionary.JoinConfiguration_Completed.name]: true,
  [dictionary.JoinConfiguration_ValidationFailed.name]: true,

  // Clickhouse Connection Events
  [dictionary.ClickhouseConnection_Started.name]: true,
  [dictionary.ClickhouseConnection_Failed.name]: true,
  [dictionary.ClickhouseConnection_Success.name]: true,

  // Destination Selection Events
  [dictionary.Destination_DatabaseSelected.name]: true,
  [dictionary.Destination_TableSelected.name]: true,
  [dictionary.Destination_ColumnsShowed.name]: true,
  [dictionary.Destination_ColumnsSelected.name]: true,
  [dictionary.Destination_DatabaseFetched.name]: true,
  [dictionary.Destination_TableFetched.name]: true,
  [dictionary.Destination_MappingCompleted.name]: true,
  [dictionary.Destination_DatabaseFetchedError.name]: true,
  [dictionary.Destination_TableFetchedError.name]: true,

  // Deploy Events
  [dictionary.Deploy_Clicked.name]: true,
  [dictionary.Deploy_Failed.name]: true,
  [dictionary.Deploy_Success.name]: true,

  // Pipeline Management Events
  [dictionary.PipelinePause_Clicked.name]: true,
  [dictionary.PipelinePause_Failed.name]: true,
  [dictionary.PipelinePause_Success.name]: true,
  [dictionary.PipelineResume_Clicked.name]: true,
  [dictionary.PipelineResume_Failed.name]: true,
  [dictionary.PipelineResume_Success.name]: true,
  [dictionary.PipelineRename_Clicked.name]: true,
  [dictionary.PipelineRename_Failed.name]: true,
  [dictionary.PipelineRename_Success.name]: true,
  [dictionary.PipelineEdit_Clicked.name]: true,
  [dictionary.PipelineEdit_Failed.name]: true,
  [dictionary.PipelineEdit_Success.name]: true,
  [dictionary.PipelineDelete_Clicked.name]: true,
  [dictionary.PipelineDelete_Failed.name]: true,
  [dictionary.PipelineDelete_Success.name]: true,

  // Legacy Pipeline Events (deprecated but kept for compatibility)
  [dictionary.PipelineModify_Clicked.name]: true,
  [dictionary.PipelineModify_Failed.name]: true,
  [dictionary.PipelineModify_Success.name]: true,

  // Pipeline Status Events
  [dictionary.Pipeline_ExistingPipeline.name]: true,
  [dictionary.Pipeline_ExistingSamePipeline.name]: true,
}

export default eventCatalog
