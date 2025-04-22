'use client'
import { TopicDeduplicationConfigurator, TopicDeduplicationConfiguratorProps } from './TopicDeduplicationConfigurator'

export const TopicDeduplicationSwitch1 = ({
  steps,
  onNext,
  validate,
  index = 0,
}: TopicDeduplicationConfiguratorProps & { index: number }) => {
  return <TopicDeduplicationConfigurator steps={steps} onNext={onNext} validate={validate} index={index} />
}
