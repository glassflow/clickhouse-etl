'use client'
import { TopicDeduplicationConfigurator, TopicDeduplicationConfiguratorProps } from './TopicDeduplicationConfigurator'
import { EventFetchProvider } from '../../components/shared/event-fetcher/EventFetchContext'

export const TopicDeduplicationSwitch2 = ({
  steps,
  onNext,
  validate,
  index = 1,
}: TopicDeduplicationConfiguratorProps & { index: number }) => {
  return (
    <EventFetchProvider>
      <TopicDeduplicationConfigurator steps={steps} onNext={onNext} validate={validate} index={index} />
    </EventFetchProvider>
  )
}
