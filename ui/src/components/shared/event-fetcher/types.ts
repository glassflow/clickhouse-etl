import { EventManagerState } from '../../../modules/kafka/hooks/useEventManagerState'

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
  state: EventManagerState
  setState: React.Dispatch<React.SetStateAction<EventManagerState>>
}
