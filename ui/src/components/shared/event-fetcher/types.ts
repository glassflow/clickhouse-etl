import { EventFetchState } from '../../../modules/kafka/hooks/useFetchEventWithCaching'

export type EventFetcherProps = {
  topicName: string
  topicIndex: number
  initialOffset: string
  initialEvent?: any
  isEditingEnabled: boolean
  onEventLoading: () => void
  onEventLoaded: (event: any) => void
  onEventError: (error: any) => void
  onEmptyTopic: () => void
  onManualEventChange?: (event: string) => void
  readOnly?: boolean
}

export type EventFetchContextType = {
  state: EventFetchState
  setState: React.Dispatch<React.SetStateAction<EventFetchState>>
}
