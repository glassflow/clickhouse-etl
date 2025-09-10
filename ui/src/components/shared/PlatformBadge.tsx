'use client'

import { usePlatform } from '@/src/contexts/PlatformContext'

const getPlatformLabel = (orchestrator: string) => {
  switch (orchestrator) {
    case 'docker':
      return 'Docker version'
    case 'k8s':
      return 'Kubernetes version'
    case 'local':
      return 'Local version'
    default:
      return 'Unknown version'
  }
}

export const PlatformBadge: React.FC = () => {
  const { platform, loading, error } = usePlatform()

  if (loading) {
    return (
      <span className="text-xs" style={{ color: '#A8ADB8' }}>
        Loading...
      </span>
    )
  }

  if (error || !platform) {
    return null // Don't show anything if there's an error or no platform info
  }

  return (
    <span className="text-xs" style={{ color: '#A8ADB8' }}>
      {getPlatformLabel(platform.orchestrator)}
    </span>
  )
}
