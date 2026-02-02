import { FieldErrors, useFormContext } from 'react-hook-form'
import { KafkaTopicSelectorType } from '@/src/scheme/topics.scheme'
import { TopicSelectorFormConfig } from '@/src/config/topic-selector-form-config'
import { useRenderFormFields, FormGroup } from '@/src/components/ui/form'
import { useState, useEffect } from 'react'

export const TopicSelectorForm = ({
  errors,
  dynamicOptions,
  onChange,
  hiddenFields = [],
}: {
  errors?: FieldErrors<KafkaTopicSelectorType>
  dynamicOptions: any
  onChange: ({ topicName, offset }: { topicName: string; offset: string }) => void
  hiddenFields?: string[]
}) => {
  const { register, watch } = useFormContext()
  const [optionsKey, setOptionsKey] = useState('initial')

  useEffect(() => {
    if (dynamicOptions && Object.keys(dynamicOptions).length > 0) {
      setOptionsKey(Math.random().toString(36).substring(2, 15))
    }
  }, [dynamicOptions])

  const topicName = watch('topicName')
  const offset = watch('offset')

  useEffect(() => {
    if (topicName && offset) {
      onChange({ topicName, offset })
    }
  }, [topicName, offset])

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: TopicSelectorFormConfig,
        formGroupName: 'topicSelector',
        register,
        errors,
        dynamicOptions,
        key: optionsKey,
        hiddenFields,
      })}
    </FormGroup>
  )
}
