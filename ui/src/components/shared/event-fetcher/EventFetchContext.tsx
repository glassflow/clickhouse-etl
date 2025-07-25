import React, { createContext, useContext, useState, ReactNode } from 'react'
import { EventFetchState } from '../../../modules/kafka/hooks/useFetchEventWithCaching'
import { EventFetchContextType } from './types'

const EventFetchContext = createContext<EventFetchContextType | undefined>(undefined)

export const EventFetchProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<EventFetchState>({
    event: null,
    currentOffset: null,
    earliestOffset: null,
    latestOffset: null,
    isAtLatest: false,
    isLoading: false,
    error: null,
    isEmptyTopic: false,
  })

  return <EventFetchContext.Provider value={{ state, setState }}>{children}</EventFetchContext.Provider>
}

export const useEventFetchContext = () => {
  const ctx = useContext(EventFetchContext)

  if (!ctx) {
    throw new Error('useEventFetchContext must be used within EventFetchProvider')
  }

  return ctx
}
