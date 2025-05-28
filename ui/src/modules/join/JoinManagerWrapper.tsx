'use client'

import { JoinManager, JoinManagerProps } from './JoinManager'
import { EventFetchProvider } from '../../components/shared/event-fetcher/EventFetchContext'

export const JoinConfiguratorWrapper = (props: JoinManagerProps) => {
  return (
    <EventFetchProvider>
      <JoinManager {...props} />
    </EventFetchProvider>
  )
}
