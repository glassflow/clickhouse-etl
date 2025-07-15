'use client'

import { JoinConfigurator, JoinConfiguratorProps } from './JoinConfigurator'
import { EventFetchProvider } from '../../components/shared/event-fetcher/EventFetchContext'

export const JoinConfiguratorWrapper = (props: JoinConfiguratorProps) => {
  return (
    <EventFetchProvider>
      <JoinConfigurator {...props} />
    </EventFetchProvider>
  )
}
