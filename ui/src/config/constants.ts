export enum StepKeys {
  KAFKA_CONNECTION = 'kafka-connection',
  TOPIC_SELECTION_1 = 'topic-selection-1',
  TOPIC_SELECTION_2 = 'topic-selection-2',
  KAFKA_TYPE_VERIFICATION = 'kafka-type-verification',
  DEDUPLICATION_CONFIGURATOR = 'deduplication-configurator',
  TOPIC_DEDUPLICATION_CONFIGURATOR_1 = 'topic-deduplication-configurator-1',
  TOPIC_DEDUPLICATION_CONFIGURATOR_2 = 'topic-deduplication-configurator-2',
  FILTER_CONFIGURATOR = 'filter-configurator',
  TRANSFORMATION_CONFIGURATOR = 'transformation-configurator',
  JOIN_CONFIGURATOR = 'join-configurator',
  CLICKHOUSE_CONNECTION = 'clickhouse-connection',
  CLICKHOUSE_MAPPER = 'clickhouse-mapper',
  REVIEW_CONFIGURATION = 'review-configuration',
  DEPLOY_PIPELINE = 'deploy-pipeline',
}

export enum EventDataFormat {
  JSON = 'json',
  AVRO = 'avro',
  PROTOBUF = 'protobuf',
}

export enum OperationKeys {
  DEDUPLICATION = 'deduplication',
  JOINING = 'joining',
  INGEST_ONLY = 'ingest-only',
  DEDUPLICATION_JOINING = 'deduplication-joining',
}

export const TIME_WINDOW_UNIT_OPTIONS = {
  SECONDS: { label: 'Seconds', value: 'seconds' },
  MINUTES: { label: 'Minutes', value: 'minutes' },
  HOURS: { label: 'Hours', value: 'hours' },
  DAYS: { label: 'Days', value: 'days' },
}

export const TIME_UNITS = {
  MILLISECONDS: { label: 'Milliseconds', value: 'ms' },
  SECONDS: { label: 'Seconds', value: 's' },
  MINUTES: { label: 'Minutes', value: 'm' },
  HOURS: { label: 'Hours', value: 'h' },
  DAYS: { label: 'Days', value: 'd' },
  MONTHS: { label: 'Months', value: 'mo' },
  YEARS: { label: 'Years', value: 'y' },
}

export const MAX_DELAY_TIME_UNITS = Object.entries(TIME_UNITS).filter(
  ([key]) => key !== 'MILLISECONDS' && key !== 'DAYS' && key !== 'MONTHS' && key !== 'YEARS',
)

export const JSON_DATA_TYPES = [
  'string',
  'bool',
  'uint',
  'uint8',
  'uint16',
  'uint32',
  'uint64',
  'int',
  'int8',
  'int16',
  'int32',
  'int64',
  'float',
  'float32',
  'float64',
  'bytes',
  'array',
]

export const JSON_DATA_TYPES_DEDUPLICATION_JOIN = ['string', 'int']

// ClickHouse data types
export const CLICKHOUSE_DATA_TYPES = [
  'String',
  'FixedString',
  'UInt8',
  'UInt16',
  'UInt32',
  'UInt64',
  'UInt128',
  'UInt256',
  'Int8',
  'Int16',
  'Int32',
  'Int64',
  'Int128',
  'Int256',
  'Float32',
  'Float64',
  'Decimal',
  'Decimal32',
  'Decimal64',
  'Decimal128',
  'Decimal256',
  'Boolean',
  'UUID',
  'Date',
  'Date32',
  'DateTime',
  'DateTime64',
  'Enum8',
  'Enum16',
  'IPv4',
  'IPv6',
  'Array',
  'Tuple',
  'Map',
  'JSON',
]

export const PIPELINE_STATUS_MAP = {
  starting: 'starting',
  active: 'active',
  pausing: 'pausing',
  paused: 'paused',
  resuming: 'resuming',
  stopping: 'stopping',
  stopped: 'stopped',
  terminating: 'terminating',
  terminated: 'terminated',
  failed: 'failed',
}

export const PIPELINE_STATUS_CONFIG = {
  starting: {
    label: 'Starting...',
    className: 'chip-neutral-faded',
    key: PIPELINE_STATUS_MAP.starting,
  },
  active: {
    label: 'Active',
    className: 'chip-positive',
    key: PIPELINE_STATUS_MAP.active,
  },
  pausing: {
    label: 'Pausing...',
    className: 'chip-neutral-faded',
    key: PIPELINE_STATUS_MAP.pausing,
  },
  paused: {
    label: 'Paused',
    className: 'chip-neutral',
    key: PIPELINE_STATUS_MAP.paused,
  },
  resuming: {
    label: 'Resuming...',
    className: 'chip-neutral-faded',
    key: PIPELINE_STATUS_MAP.resuming,
  },
  stopping: {
    label: 'Stopping...',
    className: 'chip-neutral-faded',
    key: PIPELINE_STATUS_MAP.stopping,
  },
  stopped: {
    label: 'Stopped',
    className: 'chip-negative',
    key: PIPELINE_STATUS_MAP.stopped,
  },
  terminating: {
    label: 'Terminating...',
    className: 'chip-neutral-faded',
    key: PIPELINE_STATUS_MAP.terminating,
  },
  terminated: {
    label: 'Terminated',
    className: 'chip-negative',
    key: PIPELINE_STATUS_MAP.terminated,
  },
  failed: {
    label: 'Failed',
    className: 'chip-negative',
    key: PIPELINE_STATUS_MAP.failed,
  },
} as const

export type StatusType = keyof typeof PIPELINE_STATUS_CONFIG

export const stepsMetadata = {
  [StepKeys.KAFKA_CONNECTION]: {
    key: StepKeys.KAFKA_CONNECTION,
    title: 'Setup Kafka Connection',
    description: 'Provide your Kafka credentials to send data automatically to the pipeline.',
    formTitle: 'Kafka Connection',
    formDescription: 'Provide your Kafka credentials to send data automatically to the pipeline.',
  },
  [StepKeys.TOPIC_SELECTION_1]: {
    key: StepKeys.TOPIC_SELECTION_1,
    title: 'Select Topic',
    joinTitle: 'Select Left Topic',
    description: '',
    formTitle: 'Select Topic',
    joinFormTitle: 'Select Left Topic',
    formDescription: '',
  },
  [StepKeys.TOPIC_SELECTION_2]: {
    key: StepKeys.TOPIC_SELECTION_2,
    title: 'Select Right Topic',
    joinTitle: 'Select Right Topic',
    description: '',
    formTitle: 'Select Right Topic',
    joinFormTitle: 'Select Right Topic',
    formDescription: '',
  },
  [StepKeys.DEDUPLICATION_CONFIGURATOR]: {
    key: StepKeys.DEDUPLICATION_CONFIGURATOR,
    title: 'Define Deduplicate Keys',
    description: '',
    formTitle: 'Define Deduplicate Keys',
    formDescription: '',
  },
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1]: {
    key: StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_1,
    title: 'Select Left Topic',
    description: '',
    formTitle: 'Select Left Topic',
    formDescription: '',
  },
  [StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2]: {
    key: StepKeys.TOPIC_DEDUPLICATION_CONFIGURATOR_2,
    title: 'Select Right Topic',
    description: '',
    formTitle: 'Select Right Topic',
    formDescription: '',
  },
  [StepKeys.JOIN_CONFIGURATOR]: {
    key: StepKeys.JOIN_CONFIGURATOR,
    title: 'Define Join Key',
    description: '',
    formTitle: 'Define Join Key',
    formDescription: '',
  },
  [StepKeys.KAFKA_TYPE_VERIFICATION]: {
    key: StepKeys.KAFKA_TYPE_VERIFICATION,
    title: 'Verify Field Types',
    description: 'Review and adjust the inferred data types for Kafka event fields.',
    formTitle: 'Verify Field Types',
    formDescription: 'Review and adjust the inferred data types for Kafka event fields before proceeding.',
  },
  [StepKeys.FILTER_CONFIGURATOR]: {
    key: StepKeys.FILTER_CONFIGURATOR,
    title: 'Define Filter Conditions',
    description: 'Filter events based on field conditions before processing.',
    formTitle: 'Define Filter Conditions',
    formDescription: 'Filter events based on field conditions before processing.',
  },
  [StepKeys.TRANSFORMATION_CONFIGURATOR]: {
    key: StepKeys.TRANSFORMATION_CONFIGURATOR,
    title: 'Define Transformations',
    description: 'Transform event fields using functions or pass them through unchanged.',
    formTitle: 'Define Transformations',
    formDescription:
      'Define computed fields using transformation functions or pass through existing fields to create an intermediary schema.',
  },
  [StepKeys.CLICKHOUSE_CONNECTION]: {
    title: 'Setup ClickHouse Connection',
    description: 'Provide your ClickHouse credentials to send events directly to database.',
    formTitle: 'Setup ClickHouse Connection',
    formDescription: 'Provide your ClickHouse credentials to send events directly to database.',
  },
  [StepKeys.CLICKHOUSE_MAPPER]: {
    key: StepKeys.CLICKHOUSE_MAPPER,
    title: 'Mapping',
    description: 'Map event fields to ClickHouse table columns.',
    formTitle: 'Mapping',
    formDescription: 'Map event fields to ClickHouse table columns.',
  },
  [StepKeys.REVIEW_CONFIGURATION]: {
    key: StepKeys.REVIEW_CONFIGURATION,
    title: 'Review',
    description: 'Review and deploy',
    formTitle: 'Review',
    formDescription: 'Review and deploy',
  },
  [StepKeys.DEPLOY_PIPELINE]: {
    key: StepKeys.DEPLOY_PIPELINE,
    title: 'Deploy Pipeline',
    description: 'Deploy the pipeline to the ClickHouse database.',
  },
}

export const SECURITY_PROTOCOL_OPTIONS = {
  SASL_PLAINTEXT: 'SASL_PLAINTEXT',
  SASL_SSL: 'SASL_SSL',
  SSL: 'SSL',
  PLAINTEXT: 'PLAINTEXT',
}

export const SECURITY_PROTOCOL_OPTIONS_SASL = Object.values(SECURITY_PROTOCOL_OPTIONS).filter(
  (option) => option !== SECURITY_PROTOCOL_OPTIONS.PLAINTEXT && option !== SECURITY_PROTOCOL_OPTIONS.SSL,
)

export const INITIAL_OFFSET_OPTIONS = {
  LATEST: 'latest',
  EARLIEST: 'earliest',
}

export const AUTH_OPTIONS = {
  'SASL/PLAIN': {
    name: 'SASL/PLAIN',
    label: 'SASL/PLAIN',
    securityProtocols: [SECURITY_PROTOCOL_OPTIONS.SASL_PLAINTEXT, SECURITY_PROTOCOL_OPTIONS.SASL_SSL],
    active: true,
  },
  'SASL/JAAS': {
    name: 'SASL/JAAS',
    label: 'SASL/JAAS',
    securityProtocols: [SECURITY_PROTOCOL_OPTIONS.SASL_SSL],
    active: false,
  },
  'SASL/GSSAPI': {
    name: 'SASL/GSSAPI',
    label: 'SASL/GSSAPI',
    securityProtocols: [SECURITY_PROTOCOL_OPTIONS.SASL_SSL],
    active: true,
  },
  'SASL/OAUTHBEARER': {
    name: 'SASL/OAUTHBEARER',
    label: 'SASL/OAUTHBEARER',
    securityProtocols: [SECURITY_PROTOCOL_OPTIONS.SASL_SSL],
    active: false,
  },
  'SASL/SCRAM-256': {
    name: 'SASL/SCRAM-256',
    label: 'SASL/SCRAM-256',
    securityProtocols: [SECURITY_PROTOCOL_OPTIONS.SASL_SSL],
    active: true,
  },
  'SASL/SCRAM-512': {
    name: 'SASL/SCRAM-512',
    label: 'SASL/SCRAM-512',
    securityProtocols: [SECURITY_PROTOCOL_OPTIONS.SASL_SSL],
    active: true,
  },
  'Delegation tokens': {
    name: 'Delegation tokens',
    label: 'Delegation tokens',
    securityProtocols: [SECURITY_PROTOCOL_OPTIONS.SASL_SSL],
    active: false,
  },
  'SASL/LDAP': {
    name: 'SASL/LDAP',
    label: 'SASL/LDAP',
    securityProtocols: [SECURITY_PROTOCOL_OPTIONS.SASL_SSL],
    active: false,
  },
  AWS_MSK_IAM: {
    name: 'AWS_MSK_IAM',
    label: 'AWS_MSK_IAM',
    securityProtocols: [SECURITY_PROTOCOL_OPTIONS.SASL_SSL],
    active: false,
  },
  mTLS: {
    name: 'mTLS',
    label: 'mTLS',
    securityProtocols: [SECURITY_PROTOCOL_OPTIONS.SASL_SSL],
    active: false,
  },
  // NOTE: This is not actual auth method, it is used to avoid sending auth credentials to Kafka
  NO_AUTH: {
    name: 'NO_AUTH',
    label: 'No authentication',
    securityProtocols: [
      SECURITY_PROTOCOL_OPTIONS.SASL_PLAINTEXT,
      SECURITY_PROTOCOL_OPTIONS.SSL,
      SECURITY_PROTOCOL_OPTIONS.PLAINTEXT,
    ],
    active: true,
  },
}

export const EDITOR_THEMES = [
  { value: 'ambiance', label: 'Ambiance' },
  { value: 'chaos', label: 'Chaos' },
  { value: 'chrome', label: 'Chrome' },
  { value: 'clouds', label: 'Clouds' },
  { value: 'clouds_midnight', label: 'Clouds Midnight' },
  { value: 'cobalt', label: 'Cobalt' },
  { value: 'crimson_editor', label: 'Crimson Editor' },
  { value: 'dawn', label: 'Dawn' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'dreamweaver', label: 'Dreamweaver' },
  { value: 'eclipse', label: 'Eclipse' },
  { value: 'github', label: 'GitHub' },
  { value: 'gruvbox', label: 'Gruvbox' },
  { value: 'iplastic', label: 'iPlastic' },
  { value: 'kuroir', label: 'Kuroir' },
  { value: 'merbivore', label: 'Merbivore' },
  { value: 'mono_industrial', label: 'Mono Industrial' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'nord_dark', label: 'Nord Dark' },
  { value: 'one_dark', label: 'One Dark' },
  { value: 'pastel_on_dark', label: 'Pastel on Dark' },
  { value: 'solarized_dark', label: 'Solarized Dark' },
  { value: 'solarized_light', label: 'Solarized Light' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'textmate', label: 'TextMate' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'tomorrow_night', label: 'Tomorrow Night' },
  { value: 'tomorrow_night_blue', label: 'Tomorrow Night Blue' },
  { value: 'tomorrow_night_bright', label: 'Tomorrow Night Bright' },
  { value: 'tomorrow_night_eighties', label: 'Tomorrow Night Eighties' },
  { value: 'twilight', label: 'Twilight' },
  { value: 'xcode', label: 'XCode' },
]
