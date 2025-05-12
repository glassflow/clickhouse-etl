'use client'

import { JoinConfigurator, JoinConfiguratorProps } from './JoinConfigurator'
import { EventFetchProvider } from '../../components/shared/EventFetchContext'

export const JoinConfiguratorWrapper = (props: JoinConfiguratorProps) => {
  return (
    <EventFetchProvider>
      <JoinConfigurator {...props} />
    </EventFetchProvider>
  )
}
