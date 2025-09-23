'use client'

import { useEffect } from 'react'
import { StreamConfigurator } from './StreamConfigurator'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { EventEditor } from '@/src/components/shared/EventEditor'
import { parseForCodeEditor } from '@/src/utils/common.client'

interface StreamConfiguratorListProps {
  streams: {
    joinKey: string
    joinTimeWindowValue: number
    joinTimeWindowUnit: string
  }[]
  dynamicOptions: {
    streams: {
      joinKey: { label: string; value: string }[]
      joinTimeWindowUnit: { label: string; value: string }[]
    }[]
  }
  onChange: (streamIndex: number, field: string, value: any) => void
  errors?: {
    [key: string]: string
  }
  event1: any
  event2: any
  topic1: any
  topic2: any
  readOnly?: boolean
}

export function StreamConfiguratorList({
  streams,
  dynamicOptions,
  onChange,
  errors = {},
  event1,
  event2,
  topic1,
  topic2,
  readOnly,
}: StreamConfiguratorListProps) {
  const analytics = useJourneyAnalytics()

  useEffect(() => {
    if (streams[0].joinKey) {
      analytics.key.leftJoinKey({
        key: streams[0].joinKey,
      })
    }
  }, [streams[0].joinKey])

  useEffect(() => {
    if (streams[1].joinKey) {
      analytics.key.rightJoinKey({
        key: streams[1].joinKey,
      })
    }
  }, [streams[1].joinKey])

  return (
    <div className="flex flex-col gap-8">
      {/* First stream configuration */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 w-full">
        {/* Stream Configuration */}
        <div className="w-full lg:w-1/2">
          <StreamConfigurator
            streamIndex={0}
            stream={streams[0]}
            availableKeys={dynamicOptions.streams[0].joinKey}
            onChange={onChange}
            errors={{
              joinKey: errors['streams.0.joinKey'],
              joinTimeWindowValue: errors['streams.0.joinTimeWindowValue'],
            }}
            readOnly={readOnly}
          />
        </div>

        {/* Event Preview */}
        <div className="w-full lg:w-1/2">
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">Stream 1 Sample Event</h3>
            </div>
            <div className="flex-1 bg-background-neutral rounded-md p-4 min-h-[300px]">
              <EventEditor
                key={`event1-${topic1?.name}-${JSON.stringify(event1)}`}
                event={parseForCodeEditor(event1 || {})}
                topic={topic1?.name || ''}
                isLoadingEvent={false}
                eventError={''}
                isEmptyTopic={false}
                onManualEventChange={() => {}}
                isEditingEnabled={false}
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Second stream configuration */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 w-full">
        {/* Stream Configuration */}
        <div className="w-full lg:w-1/2">
          <StreamConfigurator
            streamIndex={1}
            stream={streams[1]}
            availableKeys={dynamicOptions.streams[1].joinKey}
            onChange={onChange}
            errors={{
              joinKey: errors['streams.1.joinKey'],
              joinTimeWindowValue: errors['streams.1.joinTimeWindowValue'],
            }}
            readOnly={readOnly}
          />
        </div>

        {/* Event Preview */}
        <div className="w-full lg:w-1/2">
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">Stream 2 Sample Event</h3>
            </div>
            <div className="flex-1 bg-background-neutral rounded-md p-4 min-h-[300px]">
              <EventEditor
                key={`event2-${topic2?.name}-${JSON.stringify(event2)}`}
                event={parseForCodeEditor(event2 || {})}
                topic={topic2?.name || ''}
                isLoadingEvent={false}
                eventError={''}
                isEmptyTopic={false}
                onManualEventChange={() => {}}
                isEditingEnabled={false}
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
