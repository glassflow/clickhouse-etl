'use client'

import { KafkaTopicSelector, TopicSelectorProps } from './KafkaTopicSelector'
import { EventFetchProvider } from '../../components/shared/EventFetchContext'

export const KafkaTopicSelectorSwitch2 = ({
  steps,
  onNext,
  validate,
  index = 1,
}: TopicSelectorProps & { index: number }) => {
  return (
    <EventFetchProvider>
      <KafkaTopicSelector steps={steps} onNext={onNext} validate={validate} index={index} />
    </EventFetchProvider>
  )
}
