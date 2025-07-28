'use client'

import { JoinConfigurator, JoinConfiguratorProps } from './JoinConfigurator'
import { EventManagerContextProvider } from '../../components/shared/event-fetcher/EventManagerContext'

export const JoinConfiguratorWrapper = (props: JoinConfiguratorProps) => {
  return (
    <EventManagerContextProvider>
      <JoinConfigurator {...props} />
    </EventManagerContextProvider>
  )
}
