export function buildRegistryAuthHeaders(body: {
  authMethod?: string
  apiKey?: string
  apiSecret?: string
  username?: string
  password?: string
}): Record<string, string> {
  const { authMethod, apiKey, apiSecret, username, password } = body

  if (authMethod === 'api_key' && apiKey) {
    return { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret ?? ''}`).toString('base64')}` }
  }
  if (authMethod === 'basic' && username) {
    return { Authorization: `Basic ${Buffer.from(`${username}:${password ?? ''}`).toString('base64')}` }
  }
  // Legacy: no authMethod field (requests from older store state)
  if (!authMethod && apiKey && apiSecret) {
    return { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` }
  }
  if (!authMethod && apiKey) {
    return { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` }
  }
  return {}
}
