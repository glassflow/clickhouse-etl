'use client'
import { TopicDeduplicationConfigurator, TopicDeduplicationConfiguratorProps } from './TopicDeduplicationConfigurator'

export const TopicDeduplicationSwitch2 = ({
  steps,
  onNext,
  validate,
  index = 1,
}: TopicDeduplicationConfiguratorProps & { index: number }) => {
  return <TopicDeduplicationConfigurator steps={steps} onNext={onNext} validate={validate} index={index} />
}
