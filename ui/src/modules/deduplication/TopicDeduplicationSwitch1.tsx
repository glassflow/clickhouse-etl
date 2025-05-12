'use client'
import { TopicDeduplicationConfigurator, TopicDeduplicationConfiguratorProps } from './TopicDeduplicationConfigurator'
import { EventFetchProvider } from '../../components/shared/EventFetchContext'

export const TopicDeduplicationSwitch1 = ({
  steps,
  onNext,
  validate,
  index = 0,
}: TopicDeduplicationConfiguratorProps & { index: number }) => {
  return (
    <EventFetchProvider>
      <TopicDeduplicationConfigurator steps={steps} onNext={onNext} validate={validate} index={index} />
    </EventFetchProvider>
  )
}
