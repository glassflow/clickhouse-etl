import { KafkaStore } from '@/src/store/kafka.store'
import { useFetchEvent } from '@/src/hooks/kafka-mng-hooks'
import { useState, useEffect } from 'react'
import { useStore } from '@/src/store'

export const useFetchEventWithCaching = (
  kafka: KafkaStore,
  selectedFormat: string,
  onEventLoading: () => void,
  onEventError: (error: any) => void,
  setKafkaOffset: (offset: number) => void,
  initialOffset: string = 'latest',
  onEventLoaded?: (event: any) => void,
) => {
  const [isFromCache, setIsFromCache] = useState(false)
  const { topicsStore, kafkaStore } = useStore()
  const {
    fetchEvent,
    event,
    isLoadingEvent,
    eventError,
    hasMoreEvents,
    hasOlderEvents,
    resetEventState,
    currentOffset,
  } = useFetchEvent(kafka, selectedFormat)

  // Add state to track the current topic
  const [currentTopic, setCurrentTopic] = useState<string | null>(null)

  const {
    getTopic,
    getEvent,
    addTopic,
    updateTopic,
    // New cache methods
    getEventFromCache,
    addEventToCache,
    updateEventCache,
    clearEventCache,
    eventCache,
  } = topicsStore

  // Update event when it changes in the hook
  useEffect(() => {
    if (event && currentTopic && currentOffset !== null && !isLoadingEvent) {
      // Store in cache
      addEventToCache(currentTopic, currentOffset, event)

      // Update cache metadata
      const cache = eventCache[currentTopic]
      updateEventCache(currentTopic, {
        currentOffset: currentOffset,
        minOffset: Math.min(cache?.minOffset || Infinity, currentOffset),
        maxOffset: Math.max(cache?.maxOffset || -Infinity, currentOffset),
      })

      // Update kafka offset
      setKafkaOffset(currentOffset)

      // Notify parent if callback provided
      if (onEventLoaded) {
        onEventLoaded({
          event: event,
          position: initialOffset,
          kafkaOffset: currentOffset,
          isFromCache: isFromCache,
        })
      }
    }
  }, [event, currentOffset, isLoadingEvent, currentTopic])

  const fetchCachedEvent = (topicName: string, offset: number) => {
    if (!topicName) return

    setCurrentTopic(topicName)

    const cache = eventCache[topicName]
    if (!cache || !cache.events[offset]) {
      console.error('Event not found in cache at offset:', offset)
      return
    }

    const cachedEvent = cache.events[offset]
    setKafkaOffset(offset)
    setIsFromCache(true)
    updateEventCache(topicName, { currentOffset: offset })

    // Notify parent if callback provided
    if (onEventLoaded) {
      onEventLoaded({
        event: cachedEvent,
        position: initialOffset,
        kafkaOffset: offset,
        isFromCache: true,
      })
    }
    return cachedEvent
  }

  // Helper function to fetch event with caching
  const fetchEventWithCaching = async ({
    topicName,
    requestType,
    offsetParam,
  }: {
    topicName: string
    requestType: 'earliest' | 'latest' | 'next' | 'previous' | 'offset'
    offsetParam?: number
  }) => {
    if (!topicName) return null

    setCurrentTopic(topicName)
    onEventLoading()
    setIsFromCache(false)

    try {
      const cache = eventCache[topicName]
      let result = null

      // Case 1: Fetch "earliest" event
      if (requestType === 'earliest') {
        if (cache && cache.minOffset !== Infinity && cache.events[cache.minOffset]) {
          // Use cached earliest event
          const cachedEvent = cache.events[cache.minOffset]
          setKafkaOffset(cache.minOffset)
          updateEventCache(topicName, { currentOffset: cache.minOffset })
          setIsFromCache(true)
          result = cachedEvent
        } else {
          // Fetch from Kafka
          const newEvent = await fetchEvent(topicName, false, { position: 'earliest' })

          // Store in cache
          addEventToCache(topicName, currentOffset || 0, newEvent)
          updateEventCache(topicName, {
            minOffset: Math.min(cache?.minOffset || Infinity, currentOffset || 0),
            currentOffset: currentOffset || 0,
          })

          setKafkaOffset(currentOffset || 0)
          result = newEvent
        }
      }

      // Case 2: Fetch "latest" event - always fetch from Kafka
      if (requestType === 'latest') {
        try {
          // Call fetchEvent and get the result
          await fetchEvent(topicName, false, { position: 'latest' })

          // IMPORTANT: The event is now in the 'event' variable from useFetchEvent hook
          // We need to use that instead of the return value from fetchEvent
          if (!event) {
            return null
          }

          // Use the event from the hook
          const newEvent = event

          // Store in cache
          addEventToCache(topicName, currentOffset || 0, newEvent)
          updateEventCache(topicName, {
            maxOffset: Math.max(cache?.maxOffset || -Infinity, currentOffset || 0),
            latestOffset: currentOffset || 0,
            currentOffset: currentOffset || 0,
          })

          setKafkaOffset(currentOffset || 0)
          result = newEvent
        } catch (error) {
          console.error('Error fetching latest event:', error)
          onEventError(error)
          return null
        }
      }

      // Case 3: Fetch "next" event
      if (requestType === 'next') {
        const currentOffsetValue = offsetParam || currentOffset || (cache?.currentOffset ?? 0)
        const nextOffset = currentOffsetValue + 1

        // Check if we have the next event cached
        if (cache && cache.events[nextOffset]) {
          setKafkaOffset(nextOffset)
          updateEventCache(topicName, { currentOffset: nextOffset })
          setIsFromCache(true)
          result = cache.events[nextOffset]
        }

        // If we've reached what was previously the latest, fetch fresh latest
        if (cache && currentOffsetValue === cache.latestOffset) {
          result = await fetchEventWithCaching({ topicName: topicName, requestType: 'latest' })
        }

        // Otherwise fetch next from Kafka
        const newEvent = await fetchEvent(topicName, true)

        // Store in cache
        addEventToCache(topicName, currentOffset || 0, newEvent)
        updateEventCache(topicName, {
          maxOffset: Math.max(cache?.maxOffset || -Infinity, currentOffset || 0),
          currentOffset: currentOffset || 0,
        })

        setKafkaOffset(currentOffset || 0)
        result = newEvent
      }

      // Case 4: Fetch "previous" event
      if (requestType === 'previous') {
        const currentOffsetValue = offsetParam || currentOffset || (cache?.currentOffset ?? 0)
        const prevOffset = currentOffsetValue - 1

        // Check if we have the previous event cached
        if (cache && cache.events[prevOffset]) {
          setKafkaOffset(prevOffset)
          updateEventCache(topicName, { currentOffset: prevOffset })
          setIsFromCache(true)
          result = cache.events[prevOffset]
        }

        // If we've reached what was previously the earliest, fetch fresh earliest
        if (cache && currentOffsetValue === cache.minOffset) {
          result = await fetchEventWithCaching({ topicName: topicName, requestType: 'earliest' })
        }

        // Otherwise fetch previous from Kafka
        const newEvent = await fetchEvent(topicName, false, { direction: 'previous' })

        // Store in cache
        addEventToCache(topicName, currentOffset || 0, newEvent)
        updateEventCache(topicName, {
          minOffset: Math.min(cache?.minOffset || Infinity, currentOffset || 0),
          currentOffset: currentOffset || 0,
        })

        setKafkaOffset(currentOffset || 0)
        result = newEvent
      }

      // FIXME: fix this later - we're not supporting offset fetching yet
      // // Case 5: Fetch specific offset
      // if (requestType === 'offset' && offsetParam !== undefined) {
      //   // Check if we have this offset cached
      //   if (cache && cache.events[offsetParam]) {
      //     setKafkaOffset(offsetParam)
      //     updateEventCache(topicName, { currentOffset: offsetParam })
      //     setIsFromCache(true)
      //     console.log('Event fetched:', {
      //       requestType,
      //       result: cache.events[offsetParam] || null,
      //       isFromCache: isFromCache,
      //       currentOffset: currentOffset,
      //     })
      //     result = cache.events[offsetParam]
      //   }

      //   // Otherwise fetch from Kafka
      //   const newEvent = await fetchEvent(topicName, false, { offset: offsetParam })

      //   // Store in cache
      //   addEventToCache(topicName, currentOffset, newEvent)
      //   updateEventCache(topicName, {
      //     minOffset: Math.min(cache?.minOffset || Infinity, currentOffset),
      //     maxOffset: Math.max(cache?.maxOffset || -Infinity, currentOffset),
      //     currentOffset: currentOffset,
      //   })

      //   setKafkaOffset(currentOffset)
      //   console.log('Event fetched:', {
      //     requestType,
      //     result: newEvent || null,
      //     isFromCache: isFromCache,
      //     currentOffset: currentOffset,
      //   })
      //   result = newEvent
      // }

      if (!result) {
        console.warn(`No event returned for ${requestType} request on topic ${topicName}`)
        // Don't throw an error, just return null
        // onEventError(new Error(`No event found for ${requestType} request`));
      }

      return result
    } catch (error) {
      onEventError(error)
      return null
    }
  }

  // Simplify the handleRefreshEvent function to just trigger the fetch
  const handleRefreshEvent = (topicName: string, fetchNext: boolean = false) => {
    if (!topicName) return

    setCurrentTopic(topicName)
    console.log('Refresh event requested:', { fetchNext })
    onEventLoading()

    // Just call fetchEvent - the useEffect above will handle the result
    fetchEvent(topicName, fetchNext).catch(onEventError)
  }

  // Function to fetch next event
  const handleFetchNextEvent = (topicName: string, kafkaOffset: number) => {
    if (!topicName || kafkaOffset === null) return

    setCurrentTopic(topicName)
    console.log('Fetching next event after offset:', kafkaOffset)
    onEventLoading()

    // Check if we have next events in cache
    const cache = eventCache[topicName]
    if (cache) {
      console.log('Cache contents:', {
        allOffsets: Object.keys(cache.events)
          .map(Number)
          .sort((a, b) => a - b),
        minOffset: cache.minOffset,
        maxOffset: cache.maxOffset,
      })

      // Find the next offset in cache
      const nextOffsets = Object.keys(cache.events)
        .map(Number)
        .filter((offset) => {
          const isHigher = offset > kafkaOffset
          console.log(`Offset ${offset} > ${kafkaOffset}? ${isHigher}`)
          return isHigher
        })
        .sort((a, b) => a - b) // Sort in ascending order

      console.log('Available next offsets in cache:', nextOffsets)

      if (nextOffsets.length > 0) {
        // Use cached next event
        const nextOffset = nextOffsets[0]
        console.log('Found next event in cache at offset:', nextOffset)
        fetchCachedEvent(topicName, nextOffset)
        return
      }
    }

    // If not in cache, fetch from Kafka
    console.log('No next event in cache, fetching from Kafka')
    fetchEvent(topicName, true).catch(onEventError)
  }

  // Function to fetch previous event
  const handleFetchPreviousEvent = (topicName: string, kafkaOffset: number) => {
    if (!topicName || kafkaOffset === null) return

    setCurrentTopic(topicName)
    console.log('Fetching previous event before offset:', kafkaOffset)
    onEventLoading()

    // Check if we have previous events in cache
    const cache = eventCache[topicName]
    if (cache) {
      console.log('Cache contents for previous event lookup:', {
        allOffsets: Object.keys(cache.events)
          .map(Number)
          .sort((a, b) => a - b),
        minOffset: cache.minOffset,
        maxOffset: cache.maxOffset,
        currentOffset: kafkaOffset,
      })

      // Find the previous offset in cache
      const prevOffsets = Object.keys(cache.events)
        .map(Number)
        .filter((offset) => offset < kafkaOffset)
        .sort((a, b) => b - a) // Sort in descending order to get closest previous

      console.log('Available previous offsets in cache:', prevOffsets)

      if (prevOffsets.length > 0) {
        // Use cached previous event
        const prevOffset = prevOffsets[0]
        console.log('Found previous event in cache at offset:', prevOffset)
        fetchCachedEvent(topicName, prevOffset)
        return
      }
    }

    // If not in cache or no previous events in cache, fetch from Kafka
    console.log('No previous event in cache, fetching from Kafka with direction: previous')
    fetchEvent(topicName, false, { direction: 'previous' }).catch(onEventError)
  }

  // Function to fetch oldest event (at offset 0)
  const handleFetchOldestEvent = (topicName: string) => {
    if (!topicName) return

    setCurrentTopic(topicName)
    console.log('Fetching oldest event (at offset 0)')
    onEventLoading()

    // Clear any cached state
    setIsFromCache(false)
    setKafkaOffset(0)

    // Check if we have the earliest event cached
    const cache = eventCache[topicName]
    if (cache && cache.minOffset !== Infinity && cache.events[cache.minOffset]) {
      console.log('Using cached earliest event at offset:', cache.minOffset)
      fetchCachedEvent(topicName, cache.minOffset)
      return
    }

    // Force a fresh fetch from Kafka
    console.log('Forcing fetch from Kafka for earliest event')
    fetchEvent(topicName, false, { position: 'earliest' })
      .then(() => {
        console.log('Earliest event fetch completed')
      })
      .catch(onEventError)
  }

  // Function to fetch newest event (latest)
  const handleFetchNewestEvent = (topicName: string) => {
    if (!topicName) return

    setCurrentTopic(topicName)
    console.log('Fetching newest event (latest position)')
    onEventLoading()

    // Clear any cached state
    setIsFromCache(false)
    setKafkaOffset(0)

    // Check if we have the latest event cached
    const cache = eventCache[topicName]
    if (cache && cache.latestOffset !== undefined && cache.events[cache.latestOffset]) {
      console.log('Using cached latest event at offset:', cache.latestOffset)
      fetchCachedEvent(topicName, cache.latestOffset)
      return
    }

    // Force a fresh fetch from Kafka
    console.log('Forcing fetch from Kafka for latest event')
    fetchEvent(topicName, false, { position: 'latest' })
      .then(() => {
        console.log('Latest event fetch completed')
      })
      .catch(onEventError)
  }

  return {
    fetchEventWithCaching,
    eventCache,
    isFromCache,
    currentOffset,
    hasMoreEvents,
    hasOlderEvents,
    resetEventState,
    handleRefreshEvent,
    handleFetchNextEvent,
    handleFetchPreviousEvent,
    handleFetchOldestEvent,
    handleFetchNewestEvent,
    isLoadingEvent,
    eventError,
    fetchCachedEvent,
    event, // Export the event directly from the hook
  }
}
