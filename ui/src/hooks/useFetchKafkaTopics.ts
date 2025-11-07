import { KafkaConnectionFormType } from '@/src/scheme'
import { KafkaStore } from '@/src/store/kafka.store'
import { useCallback, useState } from 'react'
import { kafkaApiClient } from '../services/kafka-api-client'
import { notify } from '@/src/notifications'
import { kafkaMessages } from '@/src/notifications/messages'

export const useFetchTopics = ({ kafka }: { kafka: any }) => {
  const [topics, setTopics] = useState<string[]>([])
  const [topicDetails, setTopicDetails] = useState<Array<{ name: string; partitionCount: number }>>([])
  const [isLoadingTopics, setIsLoadingTopics] = useState(false)
  const [topicsError, setTopicsError] = useState<string | null>(null)
  const [fetchAttempts, setFetchAttempts] = useState(0)
  const retryAttempts = 3

  const fetchTopics = useCallback(async () => {
    if (!kafka.bootstrapServers) {
      setTopicsError('Kafka connection details are missing')
      return
    }

    setIsLoadingTopics(true)
    setTopicsError(null)

    try {
      // Fetch both topics and topic details in parallel
      // const [topicsResponse, detailsResponse] = await Promise.all([
      //   kafkaApiClient.fetchTopics(kafka),
      //   kafkaApiClient.fetchTopicDetails(kafka),
      // ])

      const topicsResponse = await kafkaApiClient.fetchTopics(kafka)
      const detailsResponse = await kafkaApiClient.fetchTopicDetails(kafka)

      if (topicsResponse.success && topicsResponse.topics) {
        setTopics(topicsResponse?.topics || [])
        setFetchAttempts(0)
      } else {
        const errorMessage = topicsResponse.error || 'Failed to fetch topics'
        setTopicsError(errorMessage)

        // Show notification to user
        notify(
          kafkaMessages.fetchTopicsFailed(() => {
            fetchTopics() // Retry
          }),
        )

        // Retry logic
        if (fetchAttempts < retryAttempts) {
          setFetchAttempts((prev) => prev + 1)
          // Could add exponential backoff here
        }
      }

      if (detailsResponse.success && detailsResponse.topicDetails) {
        setTopicDetails(detailsResponse.topicDetails || [])
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setTopicsError(errorMessage)

      // Show notification to user
      notify(
        kafkaMessages.fetchTopicsFailed(() => {
          fetchTopics() // Retry
        }),
      )
    } finally {
      setIsLoadingTopics(false)
    }
  }, [kafka, fetchAttempts, retryAttempts])

  // Utility function to get partition count for a specific topic
  const getPartitionCount = useCallback(
    (topicName: string): number => {
      const topicDetail = topicDetails.find((detail) => detail.name === topicName)
      return topicDetail?.partitionCount || 0
    },
    [topicDetails],
  )

  return { topics, topicDetails, isLoadingTopics, topicsError, fetchTopics, getPartitionCount }
}
