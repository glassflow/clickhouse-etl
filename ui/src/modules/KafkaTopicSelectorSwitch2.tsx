'use client'

import { KafkaTopicSelector, TopicSelectorProps } from './KafkaTopicSelector'

export const KafkaTopicSelectorSwitch2 = ({
  steps,
  onNext,
  validate,
  index = 1,
}: TopicSelectorProps & { index: number }) => {
  return <KafkaTopicSelector steps={steps} onNext={onNext} validate={validate} index={index} />
}
