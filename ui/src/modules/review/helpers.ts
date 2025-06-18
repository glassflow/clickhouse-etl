export function isValidApiConfig(config: any): boolean {
  if (!config) return false

  // Check required fields
  const requiredFields = ['pipeline_id', 'source', 'destination']
  if (!requiredFields.every((field) => config[field])) return false

  // Check source configuration
  if (!config.source?.topics || !Array.isArray(config.source.topics) || config.source.topics.length === 0) return false

  // Check destination configuration
  if (!config.destination?.database || !config.destination?.table) return false

  return true
}
