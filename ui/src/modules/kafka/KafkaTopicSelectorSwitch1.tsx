'use client'
import { KafkaTopicSelector, TopicSelectorProps } from './KafkaTopicSelector'
import { EventFetchProvider } from '../../components/shared/event-fetcher/EventFetchContext'

export const KafkaTopicSelectorSwitch1 = ({
  steps,
  onNext,
  validate,
  index = 0,
}: TopicSelectorProps & { index: number }) => {
  return (
    <EventFetchProvider>
      <KafkaTopicSelector steps={steps} onNext={onNext} validate={validate} index={index} />
    </EventFetchProvider>
  )
}
