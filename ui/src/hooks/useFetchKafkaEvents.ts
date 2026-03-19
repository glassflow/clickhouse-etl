import { KafkaConnectionFormType } from '@/src/scheme'
import { KafkaStore } from '@/src/store/kafka.store'
import { useState } from 'react'
import { kafkaApiClient } from '../services/kafka-api-client'
import { notify } from '@/src/notifications'
import { kafkaMessages } from '@/src/notifications/messages'

export const useFetchEvent = (kafka: KafkaStore, selectedFormat: string) => {
  const [isLoadingEvent, setIsLoadingEvent] = useState(false)
  const [eventError, setEventError] = useState<string | null>(null)
  const [event, setEvent] = useState<any>()
  const [currentOffset, setCurrentOffset] = useState<number | null>(null)
  const [hasMoreEvents, setHasMoreEvents] = useState(true)
  const [hasOlderEvents, setHasOlderEvents] = useState(false)

  const fetchEvent = async (
    topic: string,
    getNext: boolean = false,
    options?: {
      direction?: 'next' | 'previous'
      position?: 'earliest' | 'latest'
    },
  ) => {
    if (!topic) {
      setEventError('No topic specified')
      return
    }

    // Check edge cases before making the request
    if (options?.direction === 'previous' && currentOffset === null) {
      setEventError('Already at the first event')
      return
    }

    if (getNext && !hasMoreEvents) {
      setEventError('No more events available')
      return
    }

    setIsLoadingEvent(true)
    setEventError(null)

    const fetchTimeout = setTimeout(() => {
      if (isLoadingEvent) {
        setIsLoadingEvent(false)
        setEventError('Request timed out. Using sample data instead.')
        setEvent(null)
        setCurrentOffset(null)
      }
    }, 30000)

    try {
      // Handle different fetch scenarios based on options
      if (options?.position === 'latest') {
        // When requesting latest, we know there are no more events after this
        // but there should be older events before it
        setHasMoreEvents(false)
        setHasOlderEvents(true)
      } else if (options?.position === 'earliest') {
        // When requesting earliest, we know there are no older events before this
        // but there should be more events after it
        setHasMoreEvents(true)
        setHasOlderEvents(false)
      }

      const response = await kafkaApiClient.fetchEvent(kafka, {
        topic,
        format: selectedFormat,
        runConsumerFirst: true,
        getNext,
        currentOffset: currentOffset?.toString() || null,
        position: options?.position,
        direction: options?.direction,
        currentPosition: currentOffset,
      })

      clearTimeout(fetchTimeout)

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch event')
      }

      const data = response.data

      if (data && data.success) {
        setEvent(data.event)
        setIsLoadingEvent(false)

        // Extract the actual Kafka offset from the response
        const newOffset = data.offset ? parseInt(data.offset, 10) : null

        if (newOffset !== null) {
          // Update currentOffset with the actual Kafka offset
          setCurrentOffset(newOffset)

          // For position-based requests, respect the flags we set earlier
          if (!options?.position) {
            // Only update these flags for non-position requests
            if (data.metadata && data.metadata.hasOlderEvents !== undefined) {
              setHasOlderEvents(data.metadata.hasOlderEvents)
            } else if (options?.position !== 'earliest') {
              // Default to true for hasOlderEvents if not specified and not earliest
              setHasOlderEvents(true)
            }

            if (data.hasMoreEvents === false) {
              setHasMoreEvents(false)
            } else if (options?.position !== 'latest') {
              // Default to true for hasMoreEvents if not specified and not latest
              setHasMoreEvents(true)
            }
          }
        }

        if (data.isMock || data.event?._mock) {
          // If we got a mock event when trying to get the next event, it means we've reached the end
          if (getNext) {
            setHasMoreEvents(false)
            setEventError('No more events available')
          } else {
            setEventError('Note: Using sample data because actual data could not be fetched')
          }
        } else {
          setEventError(null)
        }
      } else {
        // Handle specific error cases — use notification only, no long inline error
        const err = response.error || ''
        const isNoEvents =
          err.includes('end of topic') ||
          err.includes('no more events') ||
          err.toLowerCase().includes('no events found') ||
          (err.toLowerCase().includes('no events') && err.length < 80)
        if (response.error && isNoEvents) {
          setHasMoreEvents(false)
          setEventError(null)
          notify(kafkaMessages.emptyTopicBanner(topic))
        } else if (response.error && response.error.includes('Timeout waiting for message')) {
          // Handle timeout errors specifically
          if (getNext) {
            setHasMoreEvents(false)
            setEventError('No more events available')
            notify(kafkaMessages.endOfTopicReached())
          } else if (options?.direction === 'previous') {
            setHasOlderEvents(false)
            setEventError('No previous events available')
            notify(kafkaMessages.beginningOfTopicReached())
          } else {
            const errorMsg = response.error || 'Failed to fetch event'
            setEventError(errorMsg)
            notify(kafkaMessages.timeout(() => fetchEvent(topic, getNext, options)))
          }
        } else {
          const errorMsg = response.error || 'Failed to fetch event'
          setEventError(errorMsg)
          notify(kafkaMessages.fetchEventFailed(topic, () => fetchEvent(topic, getNext, options)))
        }
      }
    } catch (error) {
      clearTimeout(fetchTimeout)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isNoEvents =
        errorMessage.includes('end of topic') ||
        errorMessage.includes('no more events') ||
        errorMessage.toLowerCase().includes('no events found') ||
        (errorMessage.toLowerCase().includes('no events') && errorMessage.length < 120)

      if (isNoEvents) {
        setHasMoreEvents(false)
        setEventError(null)
        notify(kafkaMessages.emptyTopicBanner(topic))
      } else if (errorMessage.includes('Timeout waiting for message')) {
        if (getNext) {
          setHasMoreEvents(false)
          setEventError('No more events available')
          notify(kafkaMessages.endOfTopicReached())
        } else if (options?.direction === 'previous') {
          setHasOlderEvents(false)
          setEventError('No previous events available')
          notify(kafkaMessages.beginningOfTopicReached())
        } else {
          setEventError(`Error: ${errorMessage}`)
          notify(kafkaMessages.timeout(() => fetchEvent(topic, getNext, options)))
        }
      } else {
        setEventError(`Error: ${errorMessage}`)
        notify(kafkaMessages.fetchEventFailed(topic, () => fetchEvent(topic, getNext, options)))
      }
    } finally {
      if (isLoadingEvent) {
        setIsLoadingEvent(false)
      }
    }
  }

  const resetEventState = () => {
    setEvent('')
    setEventError(null)
    setCurrentOffset(null)
    setHasMoreEvents(true)
    setHasOlderEvents(false)
  }

  return {
    fetchEvent,
    event,
    isLoadingEvent,
    eventError,
    hasMoreEvents,
    hasOlderEvents,
    resetEventState,
    currentOffset,
  }
}
