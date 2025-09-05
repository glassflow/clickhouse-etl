export type Contexts = Record<string, string>

export type Event = {
  name: string
  key: string
  contexts?: Contexts
}

export type EventGroup = {
  [key: string]: Event
}

export const dictionary: EventGroup = {
  // Consent Events
  Consent_Given: {
    name: 'Consent Given',
    key: 'Consent_Given',
  },
  Consent_NotGiven: {
    name: 'Consent Not Given',
    key: 'Consent_NotGiven',
  },

  Feedback_Submitted: {
    name: 'Feedback Submitted',
    key: 'Feedback_Submitted',
  },

  // New Journey Events (each as a separate top-level event)
  // Page Events
  P0_Homepage: {
    name: 'P0 Homepage',
    key: 'P0_Homepage',
  },
  P1_SetupKafkaConnection: {
    name: 'P1 Setup Kafka Connection',
    key: 'P1_SetupKafkaConnection',
  },
  P2_SelectTopic: {
    name: 'P2 Select Topic',
    key: 'P2_SelectTopic',
  },
  P2_SelectLeftTopic: {
    name: 'P2 Select Left Topic',
    key: 'P2_SelectLeftTopic',
  },
  P2_1_SelectRightTopic: {
    name: 'P2.1 Select Right Topic',
    key: 'P2_1_SelectRightTopic',
  },
  P3_DeduplicationKey: {
    name: 'P3 Deduplication Key',
    key: 'P3_DeduplicationKey',
  },
  P3_JoinKey: {
    name: 'P3 Join Key',
    key: 'P3_JoinKey',
  },
  P3_TopicDeduplication: {
    name: 'P3 Topic Deduplication',
    key: 'P3_TopicDeduplication',
  },
  P4_SetupClickhouseConnection: {
    name: 'P4 Setup Clickhouse Connection',
    key: 'P4_SetupClickhouseConnection',
  },
  P5_SelectDestination: {
    name: 'P5 Select Destination',
    key: 'P5_SelectDestination',
  },
  P6_Pipelines: {
    name: 'P6 Pipelines',
    key: 'P6_Pipelines',
  },

  // Operation Selection Events
  Deduplication_Clicked: {
    name: 'Deduplication Clicked',
    key: 'Deduplication_Clicked',
  },
  Join_Clicked: {
    name: 'Join Clicked',
    key: 'Join_Clicked',
  },
  DedupAndJoin_Clicked: {
    name: 'Dedup And Join Clicked',
    key: 'DedupAndJoin_Clicked',
  },
  IngestOnly_Clicked: {
    name: 'Ingest Only Clicked',
    key: 'IngestOnly_Clicked',
  },

  // Kafka Connection Events
  KafkaConnection_Started: {
    name: 'Kafka Connection Started',
    key: 'KafkaConnection_Started',
  },
  KafkaConnection_Failed: {
    name: 'Kafka Connection Failed',
    key: 'KafkaConnection_Failed',
  },
  KafkaConnection_Success: {
    name: 'Kafka Connection Success',
    key: 'KafkaConnection_Success',
  },

  // Topic Selection Events
  TopicSelected: {
    name: 'Topic Selected',
    key: 'TopicSelected',
  },
  TopicSelected_EventReceived: {
    name: 'Topic Selected Event Received',
    key: 'TopicSelected_EventReceived',
  },
  TopicSelected_NoEvent: {
    name: 'Topic Selected No Event',
    key: 'TopicSelected_NoEvent',
  },

  TopicSelected_EventError: {
    name: 'Topic Selected Event Error',
    key: 'TopicSelected_EventError',
  },

  // Key Selection Events
  DedupKeySelected: {
    name: 'Dedup Key Selected',
    key: 'DedupKeySelected',
  },
  LeftJoinKeySelected: {
    name: 'Left Join Key Selected',
    key: 'LeftJoinKeySelected',
  },
  RightJoinKeySelected: {
    name: 'Right Join Key Selected',
    key: 'RightJoinKeySelected',
  },

  // Join Configuration Events
  JoinConfiguration_Started: {
    name: 'Join Configuration Started',
    key: 'JoinConfiguration_Started',
  },
  JoinConfiguration_FieldChanged: {
    name: 'Join Configuration Field Changed',
    key: 'JoinConfiguration_FieldChanged',
  },
  JoinConfiguration_StreamConfigured: {
    name: 'Join Configuration Stream Configured',
    key: 'JoinConfiguration_StreamConfigured',
  },
  JoinConfiguration_Completed: {
    name: 'Join Configuration Completed',
    key: 'JoinConfiguration_Completed',
  },
  JoinConfiguration_ValidationFailed: {
    name: 'Join Configuration Validation Failed',
    key: 'JoinConfiguration_ValidationFailed',
  },

  // Clickhouse Connection Events
  ClickhouseConnection_Started: {
    name: 'Clickhouse Connection Started',
    key: 'ClickhouseConnection_Started',
  },
  ClickhouseConnection_Failed: {
    name: 'Clickhouse Connection Failed',
    key: 'ClickhouseConnection_Failed',
  },
  ClickhouseConnection_Success: {
    name: 'Clickhouse Connection Success',
    key: 'ClickhouseConnection_Success',
  },

  // Destination Selection Events
  Destination_DatabaseSelected: {
    name: 'Destination Database Selected',
    key: 'Destination_DatabaseSelected',
  },
  Destination_TableSelected: {
    name: 'Destination Table Selected',
    key: 'Destination_TableSelected',
  },
  Destination_ColumnsShowed: {
    name: 'Destination Columns Showed',
    key: 'Destination_ColumnsShowed',
  },
  Destination_ColumnsSelected: {
    name: 'Destination Columns Selected',
    key: 'Destination_ColumnsSelected',
  },
  Destination_DatabaseFetched: {
    name: 'Destination Database Fetched',
    key: 'Destination_DatabaseFetched',
  },
  Destination_TableFetched: {
    name: 'Destination Table Fetched',
    key: 'Destination_TableFetched',
  },
  Destination_MappingCompleted: {
    name: 'Destination Mapping Completed',
    key: 'Destination_MappingCompleted',
  },
  Destination_DatabaseFetchedError: {
    name: 'Destination Database Fetched Error',
    key: 'Destination_DatabaseFetchedError',
  },
  Destination_TableFetchedError: {
    name: 'Destination Table Fetched Error',
    key: 'Destination_TableFetchedError',
  },
  // Deploy Events
  Deploy_Clicked: {
    name: 'Deploy Clicked',
    key: 'Deploy_Clicked',
  },
  Deploy_Failed: {
    name: 'Deploy Failed',
    key: 'Deploy_Failed',
  },
  Deploy_Success: {
    name: 'Deploy Success',
    key: 'Deploy_Success',
  },

  // Pipeline Management Events
  PipelinePause_Clicked: {
    name: 'Pipeline Pause Clicked',
    key: 'PipelinePause_Clicked',
  },
  PipelinePause_Failed: {
    name: 'Pipeline Pause Failed',
    key: 'PipelinePause_Failed',
  },
  PipelinePause_Success: {
    name: 'Pipeline Pause Success',
    key: 'PipelinePause_Success',
  },
  PipelineResume_Clicked: {
    name: 'Pipeline Resume Clicked',
    key: 'PipelineResume_Clicked',
  },
  PipelineResume_Failed: {
    name: 'Pipeline Resume Failed',
    key: 'PipelineResume_Failed',
  },
  PipelineResume_Success: {
    name: 'Pipeline Resume Success',
    key: 'PipelineResume_Success',
  },
  PipelineRename_Clicked: {
    name: 'Pipeline Rename Clicked',
    key: 'PipelineRename_Clicked',
  },
  PipelineRename_Failed: {
    name: 'Pipeline Rename Failed',
    key: 'PipelineRename_Failed',
  },
  PipelineRename_Success: {
    name: 'Pipeline Rename Success',
    key: 'PipelineRename_Success',
  },
  PipelineEdit_Clicked: {
    name: 'Pipeline Edit Clicked',
    key: 'PipelineEdit_Clicked',
  },
  PipelineEdit_Failed: {
    name: 'Pipeline Edit Failed',
    key: 'PipelineEdit_Failed',
  },
  PipelineEdit_Success: {
    name: 'Pipeline Edit Success',
    key: 'PipelineEdit_Success',
  },
  PipelineDelete_Clicked: {
    name: 'Pipeline Delete Clicked',
    key: 'PipelineDelete_Clicked',
  },
  PipelineDelete_Failed: {
    name: 'Pipeline Delete Failed',
    key: 'PipelineDelete_Failed',
  },
  PipelineDelete_Success: {
    name: 'Pipeline Delete Success',
    key: 'PipelineDelete_Success',
  },

  // Legacy Pipeline Events (deprecated but kept for compatibility)
  PipelineModify_Clicked: {
    name: 'Pipeline Modify Clicked',
    key: 'PipelineModify_Clicked',
  },
  PipelineModify_Failed: {
    name: 'Pipeline Modify Failed',
    key: 'PipelineModify_Failed',
  },
  PipelineModify_Success: {
    name: 'Pipeline Modify Success',
    key: 'PipelineModify_Success',
  },

  // Pipeline Status Events
  Pipeline_ExistingPipeline: {
    name: 'Pipeline Existing Pipeline',
    key: 'Pipeline_ExistingPipeline',
  },
  Pipeline_ExistingSamePipeline: {
    name: 'Pipeline Existing Same Pipeline',
    key: 'Pipeline_ExistingSamePipeline',
  },

  // Mode Entry Events
  Mode_CreateEntered: {
    name: 'Create Mode Entered',
    key: 'Mode_CreateEntered',
  },
  Mode_EditEntered: {
    name: 'Edit Mode Entered',
    key: 'Mode_EditEntered',
  },
  Mode_ViewEntered: {
    name: 'View Mode Entered',
    key: 'Mode_ViewEntered',
  },
}
