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
  mechanism?: string
  username?: string
  password?: string
  oauthBearerToken?: string
  root_ca?: string
}
