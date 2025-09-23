import { useStore } from '../index'

function parseTimeWindow(timeWindow: string) {
  // Parse Go duration format (e.g., "3m0s", "12h", "1d") to extract value and unit
  const duration = timeWindow || '1h'

  let value = 1
  let unit: 'seconds' | 'minutes' | 'hours' | 'days' = 'hours'

  // Parse Go duration format - it can be complex like "3m0s", "1h30m", "2d12h", etc.
  // We'll normalize to the largest unit that makes sense for the UI
  const durationMatch = duration.match(/^(\d+d)?(\d+h)?(\d+m)?(\d+s)?$/)

  if (durationMatch) {
    const days = parseInt(durationMatch[1]?.replace('d', '') || '0') || 0
    const hours = parseInt(durationMatch[2]?.replace('h', '') || '0') || 0
    const minutes = parseInt(durationMatch[3]?.replace('m', '') || '0') || 0
    const seconds = parseInt(durationMatch[4]?.replace('s', '') || '0') || 0

    // Convert to total seconds for easier calculation
    const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds

    // Normalize to the largest appropriate unit for UI display
    if (totalSeconds >= 86400) {
      // 1 day or more - use days
      value = Math.round(totalSeconds / 86400)
      unit = 'days'
    } else if (totalSeconds >= 3600) {
      // 1 hour or more - use hours
      value = Math.round(totalSeconds / 3600)
      unit = 'hours'
    } else if (totalSeconds >= 60) {
      // 1 minute or more - use minutes
      value = Math.round(totalSeconds / 60)
      unit = 'minutes'
    } else {
      // Less than 1 minute - use seconds
      value = totalSeconds
      unit = 'seconds'
    }
  } else {
    // Fallback: try to parse as simple format (e.g., "12h", "30m")
    const simpleMatch = duration.match(/^(\d+)([smhd])$/)
    if (simpleMatch) {
      value = parseInt(simpleMatch[1]) || 1
      const unitLetter = simpleMatch[2]

      switch (unitLetter) {
        case 's':
          unit = 'seconds'
          break
        case 'm':
          unit = 'minutes'
          break
        case 'h':
          unit = 'hours'
          break
        case 'd':
          unit = 'days'
          break
        default:
          unit = 'hours'
      }
    }
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
