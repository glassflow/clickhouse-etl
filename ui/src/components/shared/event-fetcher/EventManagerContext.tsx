import React, { createContext, useContext, useState, ReactNode } from 'react'
import { EventFetchState } from '../../../modules/kafka/hooks/useFetchEventWithCaching'
import { EventFetchContextType } from './types'

const EventManagerContext = createContext<EventFetchContextType | undefined>(undefined)

export const EventManagerContextProvider = ({ children }: { children: ReactNode }) => {
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

  return <EventManagerContext.Provider value={{ state, setState }}>{children}</EventManagerContext.Provider>
}

export const useEventManagerContext = () => {
  const ctx = useContext(EventManagerContext)

  if (!ctx) {
    throw new Error('useEventManagerContext must be used within EventManagerContextProvider')
  }

  return ctx
}
