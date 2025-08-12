import { ApiConfig } from './types'

// Update the validation function
export const isValidApiConfig = (config: any): config is ApiConfig => {
  if (!config || typeof config !== 'object') return false

  // Check source
  if (!config.source || typeof config.source !== 'object') return false
  if (config.source.type !== 'kafka') return false
  if (!config.source.connection_params?.brokers?.length) return false
  if (!config.source.topics?.length) return false

  // Check sink
  if (!config.sink || typeof config.sink !== 'object') return false
  if (config.sink.type !== 'clickhouse') return false
  if (!config.sink.host || !config.sink.httpPort) return false
  if (!config.sink.database || !config.sink.table) return false
  if (!config.sink.table_mapping?.length) return false

  return true
}
