'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { JSON_DATA_TYPES_DEDUPLICATION_JOIN } from '@/src/config/constants'
import { StepKeys } from '@/src/config/constants'
import { TIME_WINDOW_UNIT_OPTIONS } from '@/src/config/constants'
import { v4 as uuidv4 } from 'uuid'
import { StreamConfiguratorList } from './components/StreamConfiguratorList'
import { JoinConfigType } from '@/src/scheme/join.scheme'
import { extractEventFields } from '@/src/modules/clickhouse/helpers'

export type JoinManagerProps = {
  steps: any
  onNext: (stepName: string) => void
  validate: (stepName: string, data: any) => boolean
  index: number
}

type StreamField = 'streamId' | 'joinKey' | 'dataType' | 'joinTimeWindowValue' | 'joinTimeWindowUnit'

export function JoinManager({ steps, onNext, validate, index = 0 }: JoinManagerProps) {
  const { topicsStore, joinStore } = useStore()
  const { getTopic, getEvent } = topicsStore
  const { enabled, type, streams, setEnabled, setType, setStreams } = joinStore

  // Form state
  const [formData, setFormData] = useState<JoinConfigType>({
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
  })

  // UI state
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [userInteracted, setUserInteracted] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [formIsValid, setFormIsValid] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

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

  // Generate streamIds when component mounts or when returning to form
  useEffect(() => {
    if (topic1?.name && topic2?.name) {
      const streamId1 = streams?.[0]?.streamId || `${topic1.name}_${uuidv4().slice(0, 8)}`
      const streamId2 = streams?.[1]?.streamId || `${topic2.name}_${uuidv4().slice(0, 8)}`

      setFormData((prev) => ({
        streams: [
          { ...prev.streams[0], streamId: streamId1 },
          { ...prev.streams[1], streamId: streamId2 },
        ],
      }))
    }
  }, [topic1?.name, topic2?.name, streams])

  // Handle returning to a completed step
  useEffect(() => {
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
        setFormData({
          streams: streams.map((stream) => ({
            streamId: stream.streamId,
            joinKey: stream.joinKey,
            dataType: stream.dataType,
            joinTimeWindowValue: stream.joinTimeWindowValue,
            joinTimeWindowUnit: stream.joinTimeWindowUnit,
          })),
        })
        setFormIsValid(true)
      }
    }
  }, [isReturningToForm, streams, userInteracted])

  // Validation logic
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}
    let isValid = true

    formData.streams.forEach((stream, index) => {
      if (!stream.joinKey) {
        newErrors[`streams.${index}.joinKey`] = 'Join key is required'
        isValid = false
      }
      if (!stream.dataType) {
        newErrors[`streams.${index}.dataType`] = 'Data type is required'
        isValid = false
      }
      if (!stream.joinTimeWindowValue || stream.joinTimeWindowValue < 1) {
        newErrors[`streams.${index}.joinTimeWindowValue`] = 'Time window value must be at least 1'
        isValid = false
      }
      if (!stream.joinTimeWindowUnit) {
        newErrors[`streams.${index}.joinTimeWindowUnit`] = 'Time window unit is required'
        isValid = false
      }
    })

    setErrors(newErrors)
    setFormIsValid(isValid)
    return isValid
  }

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowValidation(true)

    if (!validateForm()) {
      return
    }

    // Update store
    setEnabled(true)
    setType('temporal')
    setStreams(
      formData.streams.map((stream, index) => ({
        ...stream,
        orientation: index === 0 ? 'left' : 'right',
        topicName: index === 0 ? topic1?.name || '' : topic2?.name || '',
      })),
    )

    // Move to next step
    onNext(StepKeys.JOIN_CONFIGURATOR)
  }

  // Handle field changes
  const handleFieldChange = (streamIndex: number, field: string, value: any) => {
    setUserInteracted(true)
    setFormData((prev) => ({
      streams: prev.streams.map((stream, index) => (index === streamIndex ? { ...stream, [field]: value } : stream)),
    }))
  }

  // Check if form can continue
  const canContinue =
    (userInteracted || (isReturningToForm && formIsValid)) &&
    formData.streams.every(
      (stream) =>
        stream.streamId && stream.joinKey && stream.dataType && stream.joinTimeWindowValue && stream.joinTimeWindowUnit,
    )

  // Update dynamicOptions
  const dynamicOptions = {
    streams: [
      {
        joinKey:
          extractEventFields(event1)?.map((key) => ({
            label: key,
            value: key,
          })) || [],
        dataType: JSON_DATA_TYPES_DEDUPLICATION_JOIN.map((type) => ({
          label: type,
          value: type,
        })),
        joinTimeWindowUnit: Object.values(TIME_WINDOW_UNIT_OPTIONS).map((option) => ({
          label: option.label,
          value: option.value,
        })),
      },
      {
        joinKey:
          extractEventFields(event2)?.map((key) => ({
            label: key,
            value: key,
          })) || [],
        dataType: JSON_DATA_TYPES_DEDUPLICATION_JOIN.map((type) => ({
          label: type,
          value: type,
        })),
        joinTimeWindowUnit: Object.values(TIME_WINDOW_UNIT_OPTIONS).map((option) => ({
          label: option.label,
          value: option.value,
        })),
      },
    ],
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full">
      <div className="flex flex-col gap-6 pb-6 bg-background-neutral-faded rounded-md p-6">
        <div className="flex flex-row gap-8">
          <div className="w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-weight-[400]">
                This Kafka topic will be used as the data source for the pipeline.
              </h3>
            </div>
            <StreamConfiguratorList
              streams={formData.streams}
              dynamicOptions={dynamicOptions}
              onChange={handleFieldChange}
              errors={errors}
              event1={event1}
              event2={event2}
              topic1={topic1}
              topic2={topic2}
            />
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <Button
            variant="gradient"
            className="btn-text btn-primary"
            type="submit"
            disabled={!canContinue}
            onClick={() => {
              if (!showValidation) {
                setShowValidation(true)
                validateForm()
              }
            }}
          >
            Continue
          </Button>
        </div>
      </div>
    </form>
  )
}
