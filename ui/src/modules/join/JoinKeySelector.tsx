'use client'

import { useEffect, useState } from 'react'
import { FormGroup, renderFormField } from '@/src/components/ui/form'
import { FieldErrors, useFormContext } from 'react-hook-form'
import Image from 'next/image'
import InfoIcon from '@/src/images/info.svg'
import { KafkaTopicSelectorType } from '@/src/scheme/topics.scheme'
import { JoinKeySelectFormConfig } from '@/src/config/join-key-select-form-config'
import { Label } from '@/src/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/src/components/ui/tooltip'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { TIME_WINDOW_UNIT_OPTIONS } from '@/src/config/constants'

// Constants for time conversion
const MAX_DAYS = 7
const HOURS_IN_DAY = 24
const MINUTES_IN_HOUR = 60
const SECONDS_IN_MINUTE = 60

const MAX_HOURS = MAX_DAYS * HOURS_IN_DAY
const MAX_MINUTES = MAX_HOURS * MINUTES_IN_HOUR
const MAX_SECONDS = MAX_MINUTES * SECONDS_IN_MINUTE

export const JoinKeySelector = ({
  errors,
  dynamicOptions,
}: {
  errors?: FieldErrors<KafkaTopicSelectorType>
  dynamicOptions: any
}) => {
  const { register, watch, setError, clearErrors, setValue } = useFormContext()
  const analytics = useJourneyAnalytics()
  const [timeWindowErrors, setTimeWindowErrors] = useState<{ [key: string]: string }>({})

  const stream1JoinKey = watch(`streams.0.joinKey`)
  const stream2JoinKey = watch(`streams.1.joinKey`)

  // Watch time window values for both streams
  const stream1TimeWindow = watch(`streams.0.joinTimeWindowValue`)
  const stream1TimeUnit = watch(`streams.0.joinTimeWindowUnit`)
  const stream2TimeWindow = watch(`streams.1.joinTimeWindowValue`)
  const stream2TimeUnit = watch(`streams.1.joinTimeWindowUnit`)

  const validateTimeWindow = (value: number, unit: string, streamIndex: number) => {
    const fieldName = `streams.${streamIndex}.joinTimeWindowValue`

    switch (unit) {
      case TIME_WINDOW_UNIT_OPTIONS.DAYS.value:
        if (value > MAX_DAYS) {
          setTimeWindowErrors((prev) => ({
            ...prev,
            [fieldName]: `Maximum time window is ${MAX_DAYS} days`,
          }))
          setError(fieldName, { message: `Maximum time window is ${MAX_DAYS} days` })
          return false
        }
        break
      case TIME_WINDOW_UNIT_OPTIONS.HOURS.value:
        if (value > MAX_HOURS) {
          setTimeWindowErrors((prev) => ({
            ...prev,
            [fieldName]: `Maximum time window is ${MAX_HOURS} hours (${MAX_DAYS} days)`,
          }))
          setError(fieldName, { message: `Maximum time window is ${MAX_HOURS} hours (${MAX_DAYS} days)` })
          return false
        }
        break
      case TIME_WINDOW_UNIT_OPTIONS.MINUTES.value:
        if (value > MAX_MINUTES) {
          setTimeWindowErrors((prev) => ({
            ...prev,
            [fieldName]: `Maximum time window is ${MAX_MINUTES} minutes (${MAX_DAYS} days)`,
          }))
          setError(fieldName, { message: `Maximum time window is ${MAX_MINUTES} minutes (${MAX_DAYS} days)` })
          return false
        }
        break
      case TIME_WINDOW_UNIT_OPTIONS.SECONDS.value:
        if (value > MAX_SECONDS) {
          setTimeWindowErrors((prev) => ({
            ...prev,
            [fieldName]: `Maximum time window is ${MAX_SECONDS} seconds (${MAX_DAYS} days)`,
          }))
          setError(fieldName, { message: `Maximum time window is ${MAX_SECONDS} seconds (${MAX_DAYS} days)` })
          return false
        }
        break
    }

    setTimeWindowErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[fieldName]
      return newErrors
    })
    clearErrors(fieldName)
    return true
  }

  // Validate time windows when values change
  useEffect(() => {
    if (stream1TimeWindow && stream1TimeUnit) {
      validateTimeWindow(stream1TimeWindow, stream1TimeUnit, 0)
    }
  }, [stream1TimeWindow, stream1TimeUnit])

  useEffect(() => {
    if (stream2TimeWindow && stream2TimeUnit) {
      validateTimeWindow(stream2TimeWindow, stream2TimeUnit, 1)
    }
  }, [stream2TimeWindow, stream2TimeUnit])

  useEffect(() => {
    if (stream1JoinKey) {
      analytics.key.leftJoinKey({
        key: stream1JoinKey,
      })
    }
  }, [stream1JoinKey])

  useEffect(() => {
    if (stream2JoinKey) {
      analytics.key.rightJoinKey({
        key: stream2JoinKey,
      })
    }
  }, [stream2JoinKey])

  const getMaxValueForUnit = (unit: string) => {
    switch (unit) {
      case TIME_WINDOW_UNIT_OPTIONS.DAYS.value:
        return MAX_DAYS
      case TIME_WINDOW_UNIT_OPTIONS.HOURS.value:
        return MAX_HOURS
      case TIME_WINDOW_UNIT_OPTIONS.MINUTES.value:
        return MAX_MINUTES
      case TIME_WINDOW_UNIT_OPTIONS.SECONDS.value:
        return MAX_SECONDS
      default:
        return MAX_DAYS
    }
  }

  const handleTimeWindowChange = (value: string, streamIndex: number) => {
    const numValue = parseInt(value)
    const unit = streamIndex === 0 ? stream1TimeUnit : stream2TimeUnit
    const maxValue = getMaxValueForUnit(unit)

    // Clamp the value to the maximum allowed
    const clampedValue = Math.min(numValue, maxValue)

    // Update the form value with the clamped value
    const fieldName = `streams.${streamIndex}.joinTimeWindowValue`
    setValue(fieldName, clampedValue)

    // Validate the clamped value
    validateTimeWindow(clampedValue, unit, streamIndex)
  }

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
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                      handleTimeWindowChange(e.target.value, streamIndex),
                  },
                  className: timeWindowErrors[`streams.${streamIndex}.joinTimeWindowValue`] ? 'border-red-500' : '',
                  max: getMaxValueForUnit(streamIndex === 0 ? stream1TimeUnit : stream2TimeUnit),
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
            {timeWindowErrors[`streams.${streamIndex}.joinTimeWindowValue`] && (
              <p className="text-sm text-red-500">{timeWindowErrors[`streams.${streamIndex}.joinTimeWindowValue`]}</p>
            )}
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
