import { EventFetchState } from '../../../modules/kafka/useFetchEventWithCaching'

export type EventFetcherProps = {
  topicName: string
  topicIndex: number
  initialOffset: string
  initialEvent?: any
  onEventLoading: () => void
  onEventLoaded: (event: any) => void
  onEventError: (error: any) => void
  onEmptyTopic: () => void
  onManualEventChange?: (event: string) => void
}

export type EventFetchContextType = {
  state: EventFetchState
  setState: React.Dispatch<React.SetStateAction<EventFetchState>>
}
