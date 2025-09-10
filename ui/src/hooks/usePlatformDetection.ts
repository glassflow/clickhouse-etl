import { usePlatform } from '@/src/contexts/PlatformContext'

export const usePlatformDetection = () => {
  const { platform, loading, error } = usePlatform()

  const isDocker = platform?.orchestrator === 'docker'
  const isKubernetes = platform?.orchestrator === 'k8s'
  const isLocal = platform?.orchestrator === 'local'
  const isUnknown = platform?.orchestrator === 'unknown'

  return {
    platform,
    loading,
    error,
    isDocker,
    isKubernetes,
    isLocal,
    isUnknown,
    // Helper function to check if a feature should be disabled
    isFeatureDisabled: (feature: 'docker-only' | 'k8s-only' | 'local-only') => {
      if (loading || error || !platform) return false

      switch (feature) {
        case 'docker-only':
          return !isDocker
        case 'k8s-only':
          return !isKubernetes
        case 'local-only':
          return !isLocal
        default:
          return false
      }
    },
  }
}
