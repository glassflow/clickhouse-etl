// Define the connection config type
export type ConnectionConfig = {
  host: string
  port: string
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
  type: string
  jsonType?: string
  isNullable?: boolean
  isKey?: boolean
  eventField?: string
  sourceTopic?: string
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
