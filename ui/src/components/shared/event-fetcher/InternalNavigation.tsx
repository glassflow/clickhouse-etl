// NOTE: this component is not used atm, it's extracted from EventEditor
import { Button } from '../../ui/button'

type InternalNavigationProps = {
  fetchPreviousEvent: (topic: string, currentOffset: number) => void
  fetchNewestEvent: (topic: string) => void
  fetchOldestEvent: (topic: string) => void
  handleRefreshEvent: (topic: string, fetchNext: boolean) => void
  isLoadingEvent: boolean
  topic: string
  isAtEarliest: boolean
  eventPosition: number
  isAtLatest: boolean
}

export const InternalNavigation = ({
  fetchPreviousEvent,
  fetchNewestEvent,
  fetchOldestEvent,
  handleRefreshEvent,
  isLoadingEvent,
  topic,
  isAtEarliest,
  eventPosition,
  isAtLatest,
}: InternalNavigationProps) => {
  return (
    <div className="flex space-x-2">
      <Button
        variant="outline"
        size="sm"
        // @ts-expect-error - not typed correctly
        onClick={fetchOldestEvent}
        disabled={isLoadingEvent || !topic || isAtEarliest}
        title="Fetch oldest event"
      >
        <span className="sr-only">First</span>
        <span>⏮️</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        // @ts-expect-error - not typed correctly
        onClick={fetchPreviousEvent}
        disabled={isLoadingEvent || isAtEarliest || !topic}
        title="Fetch previous event"
      >
        <span className="sr-only">Previous</span>
        <span>⏪</span>
      </Button>

      {eventPosition > 0 && <span className="px-2">Event #{eventPosition}</span>}

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleRefreshEvent(topic, true)}
        disabled={isLoadingEvent || isAtLatest || !topic}
        title="Fetch next event"
      >
        <span className="sr-only">Next</span>
        <span>⏩</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        // @ts-expect-error - not typed correctly
        onClick={fetchNewestEvent}
        disabled={isLoadingEvent || !topic || isAtLatest}
        title="Fetch newest event"
      >
        <span className="sr-only">Latest</span>
        <span>⏭️</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleRefreshEvent(topic, false)}
        disabled={isLoadingEvent || !topic}
        title="Refresh current event"
      >
        <span className="sr-only">Refresh</span>
        <span>🔄</span>
      </Button>
    </div>
  )
}
