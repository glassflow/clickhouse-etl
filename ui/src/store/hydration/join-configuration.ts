import { useStore } from '../index'

function parseTimeWindow(timeWindow: string) {
  // e.g., '1h' => { value: 1, unit: 'h' }
  const match = /^([0-9]+)([a-zA-Z]+)$/.exec(timeWindow || '')
  if (match) {
    return { value: parseInt(match[1], 10), unit: match[2] }
  }
  return { value: 1, unit: 'h' }
}

function mapBackendJoinSourcesToStreams(sources: any[]): any[] {
  return (sources || []).map((src) => {
    const { value, unit } = parseTimeWindow(src.time_window)
    return {
      streamId: src.source_id,
      topicName: src.source_id, // If you want to display topic name, adjust as needed
      joinKey: src.join_key,
      dataType: '', // Could be filled if you have schema info
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
