import { getApiUrl } from '@/src/utils/mock-api'
import type { PlatformInfo, PlatformApiResponse } from '@/src/types/platform'
import type { ApiError } from '@/src/types/pipeline'

export const getPlatformInfo = async (): Promise<PlatformInfo> => {
  try {
    const url = getApiUrl('platform')
    const response = await fetch(url)

    if (!response.ok) {
      throw { code: response.status, message: 'Failed to fetch platform info' } as ApiError
    }

    const data: PlatformApiResponse = await response.json()

    // Map the orchestrator string to our typed values
    const orchestratorMap: Record<string, PlatformInfo['orchestrator']> = {
      docker: 'docker',
      k8s: 'k8s',
      kubernetes: 'k8s',
      local: 'local',
      unknown: 'unknown',
    }

    return {
      orchestrator: orchestratorMap[data.orchestrator] || 'unknown',
      api_version: data.api_version,
    }
  } catch (error: any) {
    if (error.code) throw error
    throw { code: 500, message: error.message || 'Failed to fetch platform info' } as ApiError
  }
}
