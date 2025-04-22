'use client'
import { KafkaTopicSelector, TopicSelectorProps } from './KafkaTopicSelector'

export const KafkaTopicSelectorSwitch1 = ({
  steps,
  onNext,
  validate,
  index = 0,
}: TopicSelectorProps & { index: number }) => {
  return <KafkaTopicSelector steps={steps} onNext={onNext} validate={validate} index={index} />
}
