import { useStore } from '../index'
import { parseGoDuration } from '@/src/utils/duration'

function parseTimeWindow(timeWindow: string) {
  const totalMs = parseGoDuration(timeWindow || '1h')
  const totalSeconds = totalMs / 1000

  let value: number
  let unit: 'seconds' | 'minutes' | 'hours' | 'days'

  if (totalSeconds >= 86400) {
    value = Math.round(totalSeconds / 86400)
    unit = 'days'
  } else if (totalSeconds >= 3600) {
    value = Math.round(totalSeconds / 3600)
    unit = 'hours'
  } else if (totalSeconds >= 60) {
    value = Math.round(totalSeconds / 60)
    unit = 'minutes'
  } else {
    value = totalSeconds
    unit = 'seconds'
  }

  return { value, unit }
}

function mapBackendJoinSourcesToStreams(sources: any[]): any[] {
  return (sources || []).map((src) => {
    const { value, unit } = parseTimeWindow(src.time_window)
    return {
      streamId: src.source_id,
      topicName: src.source_id, // If you want to display topic name, adjust as needed
      joinKey: src.join_key,
      joinTimeWindowValue: value,
      joinTimeWindowUnit: unit,
      orientation: src.orientation,
    }
  })
}

export function hydrateJoinConfiguration(pipelineConfig: any) {
  const join = pipelineConfig?.join
  if (!join) return

  useStore.getState().joinStore.setEnabled(!!join.enabled)
  useStore.getState().joinStore.setType(join.type || 'temporal')
  if (join.sources) {
    const streams = mapBackendJoinSourcesToStreams(join.sources)
    useStore.getState().joinStore.setStreams(streams)
  } else {
    useStore.getState().joinStore.setStreams([])
  }
}
