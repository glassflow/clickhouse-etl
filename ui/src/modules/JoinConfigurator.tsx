'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { JSON_DATA_TYPES_DEDUPLICATION_JOIN, OperationKeys } from '@/src/config/constants'
import { StepKeys } from '@/src/config/constants'
import { EventPreview } from '../components/wizard/EventPreview'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { parseForCodeEditor } from '@/src/utils'
import { useRenderFormFields, FormGroup, renderFormField } from '@/src/components/ui/form'
import { FieldErrors, useFormContext } from 'react-hook-form'
import Image from 'next/image'
import InfoIcon from '@/src/images/info.svg'
import { KafkaTopicSelectorType } from '@/src/scheme/topics.scheme'
import { JoinConfigSchema, JoinConfigType } from '@/src/scheme/join.scheme'
import { JoinKeySelectFormConfig } from '@/src/config/join-key-select-form-config'
import { getEventKeys } from '@/src/utils/common.client'
import { TIME_WINDOW_UNIT_OPTIONS } from '@/src/config/constants'
import { v4 as uuidv4 } from 'uuid'
import { Label } from '@/src/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/src/components/ui/tooltip'

export type JoinConfiguratorProps = {
  steps: any
  onNext: (stepName: string) => void
  validate: (stepName: string, data: any) => boolean
  index: number
}

export const JoinKeySelectorForm = ({
  errors,
  dynamicOptions,
}: {
  errors?: FieldErrors<KafkaTopicSelectorType>
  dynamicOptions: any
}) => {
  const { register } = useFormContext()
  const [optionsKey, setOptionsKey] = useState('initial')

  // NOTE: this is a hack to force a re-render of the form when the dynamic options change
  useEffect(() => {
    if (dynamicOptions && Object.keys(dynamicOptions).length > 0) {
      setOptionsKey(Math.random().toString(36).substring(2, 15))
    }
  }, [dynamicOptions])

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: JoinKeySelectFormConfig,
        formGroupName: 'joinKeySelector',
        register,
        errors,
        dynamicOptions,
        key: optionsKey, // NOTE: this is a hack to force a re-render of the form when the dynamic options change
      })}
    </FormGroup>
  )
}

export const JoinKeySelectorFormCustom = ({
  errors,
  dynamicOptions,
}: {
  errors?: FieldErrors<KafkaTopicSelectorType>
  dynamicOptions: any
}) => {
  const { register } = useFormContext()

  const renderStreamSection = (streamIndex: number) => (
    <div className="space-y-4">
      <h4 className="font-medium">Stream {streamIndex + 1}</h4>
      <div className="flex flex-col space-y-8">
        {/* Join Key and Data Type fields - split row (2/3 + 1/3) */}
        <div className="w-[90%] flex gap-3">
          <div className="w-2/3">
            {renderFormField({
              // @ts-expect-error - FIXME: fix this later
              field: JoinKeySelectFormConfig.joinKeySelector.fields[`streams.${streamIndex}.joinKey`] as any,
              register,
              errors,
              dynamicOptions,
            })}
          </div>
          <div className="w-1/3">
            {renderFormField({
              // @ts-expect-error - FIXME: fix this later
              field: JoinKeySelectFormConfig.joinKeySelector.fields[`streams.${streamIndex}.dataType`] as any,
              register,
              errors,
              dynamicOptions,
            })}
          </div>
        </div>

        {/* Time Window fields */}
        <div className="w-[90%]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="window-unit" className="label-regular text-content">
                Join Time Window
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Image src={InfoIcon} alt="Info" className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    align="start"
                    className="max-w-[300px] bg-gray-800 text-gray-100 border border-gray-700 rounded-lg p-3 shadow-lg"
                  >
                    <p className="text-sm leading-relaxed">
                      Set a value between 5 minutes to 7 days, with 1M events limit. Longer time windows can process
                      more events but may result in slower performance.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex gap-4">
              <div className="w-[20%] max-w-[20%]">
                {renderFormField({
                  // @ts-expect-error - FIXME: fix this later
                  field: JoinKeySelectFormConfig.joinKeySelector.fields[
                    `streams.${streamIndex}.joinTimeWindowValue`
                  ] as any,
                  register,
                  errors,
                  dynamicOptions,
                  // @ts-expect-error - FIXME: fix this later
                  options: {
                    valueAsNumber: true,
                  },
                })}
              </div>
              <div className="w-[40%] max-w-[40%]">
                {renderFormField({
                  // @ts-expect-error - FIXME: fix this later
                  field: JoinKeySelectFormConfig.joinKeySelector.fields[
                    `streams.${streamIndex}.joinTimeWindowUnit`
                  ] as any,
                  register,
                  errors,
                  dynamicOptions,
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <FormGroup className="space-y-8">
      {renderStreamSection(0)}
      {renderStreamSection(1)}
    </FormGroup>
  )
}

export function JoinConfigurator({ steps, onNext, validate, index = 0 }: JoinConfiguratorProps) {
  const { operationsSelected, topicsStore, kafkaStore, joinStore } = useStore()
  const {
    availableTopics,
    setAvailableTopics,
    topics: topicsFromStore,
    topicCount: topicCountFromStore,
    addTopic,
    updateTopic,
    getTopic,
    getEvent,
  } = topicsStore

  const { enabled, type, streams, setEnabled, setType, setStreams } = joinStore

  // Track if this is the initial render or a return visit
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [userInteracted, setUserInteracted] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const formInitialized = useRef(false)

  // Get existing topic data if available
  const topic1 = getTopic(index)
  const topic2 = getTopic(index + 1)
  const event1 = topic1?.events[0]?.event
  const event2 = topic2?.events[0]?.event

  // Check if we're returning to a previously filled form
  const isReturningToForm = topic1 && topic1.name && topic2 && topic2.name

  // Set initial render state
  useEffect(() => {
    if (isInitialRender && isReturningToForm) {
      setIsInitialRender(false)
    }
  }, [isInitialRender, isReturningToForm])

  // Initialize form with React Hook Form
  const formMethods = useForm<JoinConfigType>({
    resolver: zodResolver(JoinConfigSchema),
    defaultValues: {
      streams: [
        {
          streamId: streams?.[0]?.streamId || '',
          joinKey: streams?.[0]?.joinKey || '',
          dataType: streams?.[0]?.dataType || JSON_DATA_TYPES_DEDUPLICATION_JOIN[0],
          joinTimeWindowValue: streams?.[0]?.joinTimeWindowValue || 1,
          joinTimeWindowUnit: streams?.[0]?.joinTimeWindowUnit || TIME_WINDOW_UNIT_OPTIONS.MINUTES.value,
        },
        {
          streamId: streams?.[1]?.streamId || '',
          joinKey: streams?.[1]?.joinKey || '',
          dataType: streams?.[1]?.dataType || JSON_DATA_TYPES_DEDUPLICATION_JOIN[0],
          joinTimeWindowValue: streams?.[1]?.joinTimeWindowValue || 1,
          joinTimeWindowUnit: streams?.[1]?.joinTimeWindowUnit || TIME_WINDOW_UNIT_OPTIONS.MINUTES.value,
        },
      ],
    },
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  })

  const {
    watch,
    setValue,
    handleSubmit,
    register,
    trigger,
    formState: { errors, isValid, isDirty, touchedFields },
  } = formMethods

  // Generate streamIds when component mounts or when returning to form
  useEffect(() => {
    // Only generate IDs if we have topics and no existing streams
    if (!formInitialized.current && topic1?.name && topic2?.name) {
      const streamId1 = streams?.[0]?.streamId || `${topic1.name}_${uuidv4().slice(0, 8)}`
      const streamId2 = streams?.[1]?.streamId || `${topic2.name}_${uuidv4().slice(0, 8)}`

      setValue('streams.0.streamId', streamId1)
      setValue('streams.1.streamId', streamId2)

      // Mark as initialized after setting values
      formInitialized.current = true
    }
  }, [topic1?.name, topic2?.name, setValue, streams, formInitialized])

  // Add effect to handle validation when returning to a completed step
  const [formIsValid, setFormIsValid] = useState(false)

  useEffect(() => {
    // When returning to a previously completed step, validate the form
    if (isReturningToForm && streams?.length === 2 && !userInteracted) {
      const hasCompleteData = streams.every(
        (stream) =>
          stream?.streamId &&
          stream?.joinKey &&
          stream?.dataType &&
          stream?.joinTimeWindowValue &&
          stream?.joinTimeWindowUnit,
      )

      if (hasCompleteData) {
        // Set form values from existing data
        streams.forEach((stream, index) => {
          if (stream.joinKey) setValue(`streams.${index}.joinKey`, stream.joinKey)
          if (stream.dataType) setValue(`streams.${index}.dataType`, stream.dataType)
          if (stream.joinTimeWindowValue) setValue(`streams.${index}.joinTimeWindowValue`, stream.joinTimeWindowValue)
          if (stream.joinTimeWindowUnit) setValue(`streams.${index}.joinTimeWindowUnit`, stream.joinTimeWindowUnit)
        })

        // For returning users with valid data, we still want to set formIsValid without showing errors
        setFormIsValid(true)
      }
    }
  }, [isReturningToForm, streams, userInteracted, setValue, trigger])

  // Update validation logic to support both new form entry and returning to a completed step
  const canContinue =
    (isDirty || (isReturningToForm && formIsValid)) &&
    streams?.every(
      (stream) =>
        stream?.streamId &&
        stream?.joinKey &&
        stream?.dataType &&
        stream?.joinTimeWindowValue &&
        stream?.joinTimeWindowUnit,
    )

  // Handle form submission with validation
  const onSubmit = async (data: JoinConfigType) => {
    // Set showValidation to true to display any validation errors
    setShowValidation(true)

    // Trigger validation on submit
    const isValid = await trigger()
    if (!isValid) {
      return
    }

    // Update topic in the store
    setEnabled(true)
    setType('temporal')
    setStreams(
      data.streams.map((stream, index) => ({
        ...stream,
        orientation: index === 0 ? 'left' : 'right',
        topicName: index === 0 ? topic1?.name || '' : topic2?.name || '',
      })),
    )

    // Move to next step
    onNext(StepKeys.JOIN_CONFIGURATOR)
  }

  // Handle any form field change
  const handleFormChange = () => {
    setUserInteracted(true)
    // Only update formIsValid if we're already showing validation
    if (showValidation) {
      trigger().then((isValid) => {
        setFormIsValid(isValid)
      })
    }
  }

  // Add direct event states
  const [currentEvent1, setCurrentEvent1] = useState<any>(null)
  const [currentEvent2, setCurrentEvent2] = useState<any>(null)

  // Remove event received refs as they prevent refetching
  // const eventReceivedRef1 = useRef(false)
  // const eventReceivedRef2 = useRef(false)

  // Clear events when topics change
  useEffect(() => {
    if (!topic1?.name) {
      setCurrentEvent1(null)
    }
    if (!topic2?.name) {
      setCurrentEvent2(null)
    }
  }, [topic1?.name, topic2?.name])

  // Simplified event fetching logic
  useEffect(() => {
    const fetchEventData = async (topicName: string, initialOffset: string, setEvent: (data: any) => void) => {
      console.log(`Fetching event for topic: ${topicName}`)

      try {
        // Get the event directly from the store
        // @ts-expect-error - FIXME: fix this later
        const eventData = getEvent(topicName, false, {
          position: initialOffset || 'latest',
        })

        if (eventData && eventData.event) {
          console.log(`Fetched event for ${topicName}:`, eventData.event)
          setEvent(eventData.event)
        } else {
          console.warn(`No event data found for ${topicName}`)
          setEvent(null)
        }
      } catch (error) {
        console.error(`Error fetching event for ${topicName}:`, error)
        setEvent(null)
      }
    }

    // Fetch events whenever topics change
    if (topic1?.name) {
      fetchEventData(topic1.name, topic1.initialOffset || 'latest', setCurrentEvent1)
    }

    if (topic2?.name) {
      fetchEventData(topic2.name, topic2.initialOffset || 'latest', setCurrentEvent2)
    }
  }, [topic1?.name, topic1?.initialOffset, topic2?.name, topic2?.initialOffset, getEvent, topicsStore])

  // Update dynamicOptions to create a new object when events change
  const dynamicOptions = {
    'streams.0.joinKey':
      getEventKeys(
        // Try to get the event data from all possible sources
        (event1 && event1.event) || currentEvent1 || (topic1?.events[0]?.event && topic1.events[0].event.event),
      )?.map((key) => ({
        label: key,
        value: key,
      })) || [],
    'streams.0.dataType': JSON_DATA_TYPES_DEDUPLICATION_JOIN.map((type) => ({
      label: type,
      value: type,
    })),
    'streams.0.joinTimeWindowUnit': Object.values(TIME_WINDOW_UNIT_OPTIONS).map((option) => ({
      label: option.label,
      value: option.value,
    })),
    'streams.1.joinKey':
      getEventKeys(
        // Try to get the event data from all possible sources
        (event2 && event2.event) || currentEvent2 || (topic2?.events[0]?.event && topic2.events[0].event.event),
      )?.map((key) => ({
        label: key,
        value: key,
      })) || [],
    'streams.1.dataType': JSON_DATA_TYPES_DEDUPLICATION_JOIN.map((type) => ({
      label: type,
      value: type,
    })),
    'streams.1.joinTimeWindowUnit': Object.values(TIME_WINDOW_UNIT_OPTIONS).map((option) => ({
      label: option.label,
      value: option.value,
    })),
  }

  // Run validation on component mount if returning to a completed step
  useEffect(() => {
    // Only need to run this validation once when the component mounts
    if (isReturningToForm && streams?.length === 2) {
      const hasCompleteData = streams.every(
        (stream) =>
          stream?.streamId &&
          stream?.joinKey &&
          stream?.dataType &&
          stream?.joinTimeWindowValue &&
          stream?.joinTimeWindowUnit,
      )

      if (hasCompleteData) {
        // For returning users with complete data, set formIsValid without showing validation errors
        setFormIsValid(true)

        // We want to avoid triggering validation for returning users initially
        // but make sure the form has values
        streams.forEach((stream, index) => {
          if (stream.joinKey) setValue(`streams.${index}.joinKey`, stream.joinKey)
          if (stream.dataType) setValue(`streams.${index}.dataType`, stream.dataType)
          if (stream.joinTimeWindowValue) setValue(`streams.${index}.joinTimeWindowValue`, stream.joinTimeWindowValue)
          if (stream.joinTimeWindowUnit) setValue(`streams.${index}.joinTimeWindowUnit`, stream.joinTimeWindowUnit)
        })
      }
    }
  }, [isReturningToForm, streams, setValue])

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 w-full" onChange={handleFormChange}>
        {/* Main container - adjust padding and height */}
        <div className="flex flex-col gap-6 pb-6 bg-background-neutral-faded rounded-md p-6">
          {/* Row container - split into equal halves */}
          <div className="flex flex-row gap-8">
            {/* Left Column - Form Fields (50%) */}
            <div className="w-1/2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-weight-[400]">
                  This Kafka topic will be used as the data source for the pipeline.
                </h3>
              </div>
              <JoinKeySelectorFormCustom errors={errors} dynamicOptions={dynamicOptions} />
            </div>

            {/* Right Column - Event Previews (50%) */}
            <div className="w-1/2">
              {/* First Event Preview */}
              <div className="mb-6 h-full h-[300px] max-h-[300px]">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Stream 1 Sample Event</h3>
                </div>
                <div className="bg-background-neutral rounded-md p-4 h-full min-h-[300px]">
                  <EventPreview
                    key={`event1-${topic1?.name}-${JSON.stringify(currentEvent1)}`}
                    showInternalNavigationButtons={false}
                    event={parseForCodeEditor(event1?.event || currentEvent1 || {})}
                    topic={topic1?.name || ''}
                    isLoadingEvent={false}
                    eventError={''}
                    handleRefreshEvent={() => {}}
                    hasMoreEvents={false}
                    handleFetchPreviousEvent={() => {}}
                    handleFetchNewestEvent={() => {}}
                    handleFetchOldestEvent={() => {}}
                    hasOlderEvents={false}
                    eventPosition={0}
                  />
                </div>
              </div>

              {/* Second Event Preview */}
              <div className="h-full h-[300px] max-h-[300px]">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Stream 2 Sample Event</h3>
                </div>
                <div className="bg-background-neutral rounded-md p-4 h-full min-h-[300px]">
                  <EventPreview
                    key={`event2-${topic2?.name}-${JSON.stringify(currentEvent2)}`}
                    showInternalNavigationButtons={false}
                    event={parseForCodeEditor(event2?.event || currentEvent2 || {})}
                    topic={topic2?.name || ''}
                    isLoadingEvent={false}
                    eventError={''}
                    handleRefreshEvent={() => {}}
                    hasMoreEvents={false}
                    handleFetchPreviousEvent={() => {}}
                    handleFetchNewestEvent={() => {}}
                    handleFetchOldestEvent={() => {}}
                    hasOlderEvents={false}
                    eventPosition={0}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <div className="flex justify-between mt-6">
            <Button
              variant="gradient"
              className="btn-text btn-primary"
              type="submit"
              disabled={!canContinue}
              onClick={() => {
                if (!showValidation) {
                  setShowValidation(true)
                  trigger()
                }
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
