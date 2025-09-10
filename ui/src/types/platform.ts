export interface PlatformInfo {
  orchestrator: 'docker' | 'k8s' | 'local' | 'unknown'
  api_version?: string
}

export interface PlatformApiResponse {
  orchestrator: string
  api_version?: string
}
