import { dictionary } from './eventDictionary'

const eventCatalog: Record<string, boolean> = {
  // Consent Events
  [dictionary.Consent_Given.name]: true,
  [dictionary.Consent_NotGiven.name]: true,

  // Journey Page Events
  [dictionary.P0_Homepage.name]: true,
  [dictionary.P1_SetupKafkaConnection.name]: true,
  [dictionary.P2_SelectTopic.name]: true,
  [dictionary.P2_SelectLeftTopic.name]: true,
  [dictionary.P2_1_SelectRightTopic.name]: true,
  [dictionary.P3_DeduplicationKey.name]: true,
  [dictionary.P3_JoinKey.name]: true,
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

  // Key Selection Events
  [dictionary.DedupKeySelected.name]: true,
  [dictionary.LeftJoinKeySelected.name]: true,
  [dictionary.RightJoinKeySelected.name]: true,

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

  // Pipeline Modification Events
  [dictionary.PipelineModify_Clicked.name]: true,
  [dictionary.PipelineModify_Failed.name]: true,
  [dictionary.PipelineModify_Success.name]: true,
  [dictionary.PipelineDelete_Clicked.name]: true,
  [dictionary.PipelineDelete_Failed.name]: true,
  [dictionary.PipelineDelete_Success.name]: true,

  // Pipeline Status Events
  [dictionary.Pipeline_ExistingPipeline.name]: true,
  [dictionary.Pipeline_ExistingSamePipeline.name]: true,
  [dictionary.Pipeline_NoPipeline_Deploying.name]: true,
  [dictionary.Pipeline_NoPipeline_NoConfig.name]: true,
  [dictionary.Pipeline_NoValidConfig.name]: true,
}

export default eventCatalog
