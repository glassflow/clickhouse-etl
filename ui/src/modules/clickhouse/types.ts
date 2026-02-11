// Define the connection config type
export type ConnectionConfig = {
  host: string
  httpPort: string
  username: string
  password: string
  database?: string
  useSSL?: boolean
  connectionType: 'direct'
}

// Define the test function types
export type DatabaseAccessTestFn = (connectionConfig: ConnectionConfig) => Promise<{
  success: boolean
  error?: string
}>

export type TableAccessTestFn = (connectionConfig: ConnectionConfig) => Promise<{
  success: boolean
  error?: string
}>

export interface TableColumn {
  name: string
  type?: string
  column_type?: string // Alternative field name from ClickHouse API (same as 'type')
  jsonType?: string
  isNullable?: boolean
  isKey?: boolean
  eventField?: string
  sourceTopic?: string
  default_type?: string // 'DEFAULT', 'MATERIALIZED', 'ALIAS', or ''
  default_expression?: string // The default expression (e.g., 'now()')
  default_kind?: string // Alternative field name used by system.columns query
}

export interface TableSchema {
  columns: TableColumn[]
}

export interface SampleEvent {
  [key: string]: any
}

export interface KafkaConnectionParams {
  brokers: string[]
  protocol: string
  skip_auth?: boolean // Deprecated: backend now uses mechanism: "NO_AUTH" instead
  skip_tls_verification?: boolean
  mechanism: string
  username?: string
  password?: string
  oauthBearerToken?: string
  root_ca?: string
  principal?: string
  kerberosKeytab?: string
  kerberosRealm?: string
  kdc?: string
  serviceName?: string
  krb5Config?: string
  useTicketCache?: boolean
  ticketCachePath?: string
}

// ============================================================================
// ClickhouseMapper Types
// ============================================================================

/**
 * Operation mode for the ClickhouseMapper component.
 * - 'single': Single topic to ClickHouse mapping
 * - 'join': Two topics joined before mapping to ClickHouse
 * - 'dedup': Deduplication mode (currently treated same as join)
 */
export type MappingMode = 'single' | 'join' | 'dedup'

/**
 * Validation severity level for mapping validation results.
 */
export type ValidationType = 'error' | 'warning' | 'info'

/**
 * Result of mapping validation check.
 * Used to determine if save/deploy can proceed and what modal to show.
 */
export interface ValidationResult {
  type: ValidationType
  canProceed: boolean
  message: string
  title: string
  okButtonText: string
  cancelButtonText: string
}

/**
 * Tracks various validation issues in the mapping configuration.
 * Used for real-time validation feedback in the UI.
 */
export interface ValidationIssues {
  /** Columns that are nullable and not mapped (warning) */
  unmappedNullableColumns: string[]
  /** Columns that are NOT NULL and not mapped (error) */
  unmappedNonNullableColumns: string[]
  /** Columns with DEFAULT expressions that are not mapped (warning) */
  unmappedDefaultColumns: string[]
  /** Event fields that have no corresponding column mapping */
  extraEventFields: string[]
  /** Mappings where source type is incompatible with destination type */
  incompatibleTypeMappings: TableColumn[]
  /** Mappings where the source type could not be determined */
  missingTypeMappings: TableColumn[]
}
