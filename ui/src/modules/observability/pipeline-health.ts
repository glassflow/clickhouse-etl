import type { ListPipelineConfig } from '@/src/types/pipeline'

export function isDegraded(p: ListPipelineConfig): boolean {
  return p.status === 'failed' || p.health_status === 'unstable'
}

export function isPaused(p: ListPipelineConfig): boolean {
  return p.status === 'paused' || p.status === 'pausing'
}
