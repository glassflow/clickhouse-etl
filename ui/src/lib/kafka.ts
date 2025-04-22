import { Kafka, Consumer, logLevel, KafkaMessage } from 'kafkajs'
import { createAwsIamMechanism } from '../utils/common.server'

export interface KafkaConfig {
  brokers: string[]
  securityProtocol?: string
  authMethod?: string
  clientId?: string
  groupId?: string

  // SASL/PLAIN
  username?: string
  password?: string

  // SASL/JAAS
  jaasConfig?: string

  // SASL/GSSAPI (Kerberos)
  kerberosPrincipal?: string
  kerberosKeytab?: string
  kerberosRealm?: string
  kdc?: string

  // SASL/OAUTHBEARER
  oauthBearerToken?: string

  // AWS IAM
  awsRegion?: string
  awsIAMRoleArn?: string
  awsAccessKey?: string
  awsAccessKeySecret?: string

  // Delegation tokens
  delegationToken?: string

  // LDAP
  ldapServerUrl?: string
  ldapServerPort?: string
  ldapBindDn?: string
  ldapBindPassword?: string
  ldapUserSearchFilter?: string
  ldapBaseDn?: string

  // mTLS
  clientCert?: string
  clientKey?: string

  // SSL/TLS
  truststore?: {
    location?: string
    password?: string
    type?: string
    algorithm?: string
    certificates?: string[]
  }

  certificate?: string
}

export interface KafkaEvent {
  topic: string
  partition: number
  offset: string
  timestamp: string
  key: string | null
  value: any
  headers?: Record<string, string>
}

export class KafkaClient {
  private kafka: Kafka
  private consumer: Consumer | null = null
  private config: KafkaConfig
  private consumerPositions: Map<string, { offset: string; partition: number }> = new Map()

  constructor(config: KafkaConfig) {
    this.config = config

    // Base Kafka configuration
    const kafkaConfig: any = {
      clientId: config.clientId || 'kafka-client',
      brokers: config.brokers,
      logLevel: logLevel.DEBUG,
    }

    // Configure SSL
    if (config.securityProtocol === 'SASL_SSL' || config.securityProtocol === 'SSL') {
      kafkaConfig.ssl = {
        rejectUnauthorized: true,
        ca: config.certificate ? [config.certificate] : undefined,
      }
    } else {
      kafkaConfig.ssl = false
    }

    // Configure authentication
    if (config.securityProtocol?.startsWith('SASL')) {
      switch (config.authMethod) {
        case 'SASL/PLAIN':
          kafkaConfig.sasl = {
            mechanism: 'plain',
            username: config.username,
            password: config.password,
          }
          break

        case 'SASL/JAAS':
          // Implement JAAS configuration
          // This might require custom handling depending on your Kafka library
          break

        case 'SASL/GSSAPI':
          kafkaConfig.sasl = {
            mechanism: 'gssapi',
            kerberosPrincipal: config.kerberosPrincipal,
            kerberosKeytab: config.kerberosKeytab,
            kerberosRealm: config.kerberosRealm,
            kdc: config.kdc,
          }
          break

        case 'SASL/OAUTHBEARER':
          kafkaConfig.sasl = {
            mechanism: 'oauthbearer',
            oauthBearerToken: config.oauthBearerToken,
          }
          break

        case 'SASL/SCRAM-256':
          kafkaConfig.sasl = {
            mechanism: 'scram-sha-256',
            username: config.username,
            password: config.password,
          }
          break

        case 'SASL/SCRAM-512':
          kafkaConfig.sasl = {
            mechanism: 'scram-sha-512',
            username: config.username,
            password: config.password,
          }
          break

        case 'AWS_MSK_IAM':
          try {
            // Use the built-in mechanism creator
            const mechanism = createAwsIamMechanism(
              config.awsRegion || 'eu-central-1',
              config.awsAccessKey || '',
              config.awsAccessKeySecret || '',
            )
            kafkaConfig.sasl = mechanism
          } catch (error) {
            console.error('Error setting up AWS_MSK_IAM authentication:', error)
            throw error
          }
          break

        case 'Delegation tokens':
          // Implement delegation token authentication
          break

        case 'SASL/LDAP':
          // LDAP authentication might require custom implementation
          break

        case 'mTLS':
          // mTLS is typically handled via SSL configuration
          // You might need to set client certificates in the SSL config
          if (config.clientCert && config.clientKey) {
            kafkaConfig.ssl = {
              ...kafkaConfig.ssl,
              cert: config.clientCert,
              key: config.clientKey,
              passphrase: config.password,
            }
          }
          break
      }
    }

    const kafkaInstance = new Kafka(kafkaConfig)
    this.kafka = kafkaInstance
  }

  async testConnection(): Promise<boolean> {
    try {
      const admin = this.kafka.admin()
      await admin.connect()
      await admin.listTopics()
      await admin.disconnect()
      return true
    } catch (error) {
      console.error('Failed to connect to Kafka:', error)
      return false
    }
  }

  async listTopics(): Promise<string[]> {
    try {
      const admin = this.kafka.admin()
      await admin.connect()

      const metadata = await admin.fetchTopicMetadata()
      const topics = metadata.topics.map((topic) => topic.name)

      await admin.disconnect()
      return topics
    } catch (error) {
      console.error('Error listing Kafka topics:', error)
      throw error
    }
  }

  async initializeConsumer(): Promise<void> {
    if (!this.consumer) {
      this.consumer = this.kafka.consumer({ groupId: this.config.groupId || 'default-group' })
      await this.consumer.connect()
    }
  }

  async subscribeToTopics(topics: string[]): Promise<void> {
    if (!this.consumer) {
      await this.initializeConsumer()
    }

    for (const topic of topics) {
      await this.consumer!.subscribe({ topic, fromBeginning: true })
    }
  }

  private messageToEvent(message: KafkaMessage, topic: string, partition: number): KafkaEvent {
    return {
      topic,
      partition,
      offset: message.offset,
      timestamp: message.timestamp,
      key: message.key?.toString() || null,
      value: message.value ? JSON.parse(message.value.toString()) : null,
      headers: message.headers
        ? Object.fromEntries(Object.entries(message.headers).map(([key, value]) => [key, value?.toString() || '']))
        : undefined,
    }
  }

  async consumeEvents(onEvent: (event: KafkaEvent) => void): Promise<void> {
    if (!this.consumer) {
      throw new Error('Consumer not initialized. Call subscribeToTopics first.')
    }

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const event = this.messageToEvent(message, topic, partition)
        onEvent(event)
      },
    })
  }

  async disconnect(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect()
      this.consumer = null
    }
  }

  async fetchSampleEvent(
    topic: string,
    format: string = 'JSON',
    getNext: boolean = false,
    currentOffset: string | null = null,
    options?: {
      position?: 'earliest' | 'latest'
      direction?: 'next' | 'previous'
      partition?: number
    },
  ): Promise<any> {
    let consumer: Consumer | null = null
    try {
      const startTime = Date.now()
      console.log(
        `KafkaClient: START: Attempting to fetch sample event from topic: ${topic} with format: ${format}`,
        options ? `options: ${JSON.stringify(options)}` : '',
        getNext ? `getNext: true, currentOffset: ${currentOffset}` : '',
      )

      // Test connection first
      console.log('KafkaClient: Testing connection...')
      const isConnected = await this.testConnection()
      if (!isConnected) {
        console.error('KafkaClient: Failed to connect to Kafka')
        throw new Error('Failed to connect to Kafka')
      }

      console.log('KafkaClient: Successfully connected to Kafka')

      // Check if topic exists and get partition information
      console.log(`KafkaClient: Checking if topic ${topic} exists and has messages`)
      const admin = this.kafka.admin()
      await admin.connect()

      let targetPartition = options?.partition !== undefined ? options.partition : 0
      let targetOffset: string | null = null

      try {
        // Get topic metadata
        const metadata = await admin.fetchTopicMetadata({ topics: [topic] })
        if (!metadata.topics.length || metadata.topics[0].name !== topic) {
          console.error(`KafkaClient: Topic ${topic} does not exist`)
          throw new Error(`Topic ${topic} does not exist`)
        }

        // Check if topic has partitions
        const topicInfo = metadata.topics[0]
        if (!topicInfo.partitions.length) {
          console.error(`KafkaClient: Topic ${topic} has no partitions`)
          throw new Error(`Topic ${topic} has no partitions`)
        }

        console.log(`KafkaClient: Topic ${topic} exists with ${topicInfo.partitions.length} partitions`)

        // Try to get offsets for the topic
        const offsets = await admin.fetchTopicOffsets(topic)
        console.log('KafkaClient: Topic offsets:', JSON.stringify(offsets))

        // Check if topic has any messages
        const hasMessages = offsets.some((partition) => parseInt(partition.high, 10) > parseInt(partition.low, 10))

        if (!hasMessages) {
          console.error(`KafkaClient: Topic ${topic} exists but has no messages`)
          throw new Error(`Topic ${topic} exists but has no messages`)
        }

        // Find the partition with messages if not specified
        if (options?.partition === undefined) {
          const partitionWithMessages = offsets.find(
            (partition) => parseInt(partition.high, 10) > parseInt(partition.low, 10),
          )

          if (partitionWithMessages) {
            targetPartition = partitionWithMessages.partition
            console.log(`KafkaClient: Selected partition ${targetPartition} which has messages`)
          }
        }

        // Determine the target offset based on options
        if (options?.position === 'latest') {
          // For latest, find the highest offset and subtract 1 to get the last message
          const partitionInfo = offsets.find((p) => p.partition === targetPartition)
          if (partitionInfo) {
            const highOffset = parseInt(partitionInfo.high, 10)
            if (highOffset > 0) {
              targetOffset = (highOffset - 1).toString()
              console.log(`KafkaClient: Using latest offset: ${targetOffset} for partition ${targetPartition}`)
            } else {
              console.log(`KafkaClient: Partition ${targetPartition} has no messages (high offset is ${highOffset})`)
              targetOffset = '0'
            }
          }
        } else if (options?.position === 'earliest') {
          // For earliest, use the low offset
          const partitionInfo = offsets.find((p) => p.partition === targetPartition)
          if (partitionInfo) {
            targetOffset = partitionInfo.low
            console.log(`KafkaClient: Using earliest offset: ${targetOffset} for partition ${targetPartition}`)
          }
        } else if (getNext && currentOffset !== null) {
          // For next, use current offset + 1
          targetOffset = (BigInt(currentOffset) + BigInt(1)).toString()
          console.log(`KafkaClient: Using next offset: ${targetOffset} for partition ${targetPartition}`)
        } else if (options?.direction === 'previous' && currentOffset !== null) {
          // For previous, use current offset - 1, but ensure it's not less than the low offset
          const partitionInfo = offsets.find((p) => p.partition === targetPartition)
          if (partitionInfo) {
            const lowOffset = BigInt(partitionInfo.low)
            const prevOffset = BigInt(currentOffset) - BigInt(1)
            targetOffset = prevOffset < lowOffset ? lowOffset.toString() : prevOffset.toString()
            console.log(`KafkaClient: Using previous offset: ${targetOffset} for partition ${targetPartition}`)
          }
        }

        console.log(`KafkaClient: Topic ${topic} has messages`)
      } finally {
        await admin.disconnect()
      }

      // Use a consistent consumer group ID for the topic to maintain position
      // But add a unique suffix to avoid conflicts with other consumers
      const baseGroupId = `${this.config.groupId || 'sample'}-${topic.replace(/[^a-zA-Z0-9]/g, '-')}`
      const uniqueGroupId = `${baseGroupId}-${Math.random().toString(36).substring(2, 10)}`
      console.log(`KafkaClient: Using consumer group ID: ${uniqueGroupId}`)

      consumer = this.kafka.consumer({
        groupId: uniqueGroupId,
        sessionTimeout: 30000,
      })
      console.log(`KafkaClient: Consumer created, connecting...`)

      // Set a timeout for the connect operation
      const connectPromise = Promise.race([
        consumer.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout connecting to Kafka')), 5000)),
      ])

      await connectPromise
      console.log(`KafkaClient: Consumer connected, subscribing to topic...`)

      // Set a timeout for the subscribe operation
      const subscribePromise = Promise.race([
        consumer.subscribe({ topic, fromBeginning: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout subscribing to topic')), 5000)),
      ])

      await subscribePromise
      console.log(`KafkaClient: Subscribed to topic: ${topic}`)

      // Create a promise that will resolve with the first message or reject after timeout
      const messagePromise = new Promise((resolve, reject) => {
        let timeoutId: NodeJS.Timeout | null = null
        let messageReceived = false

        console.log(`KafkaClient: Setting up message handler...`)

        const messageHandler = async ({ topic, partition, message }: any) => {
          const messageTime = Date.now()
          console.log(
            `KafkaClient: Received message from topic: ${topic}, partition: ${partition}, offset: ${message.offset}, after ${messageTime - startTime}ms`,
          )

          // Only process messages from the target partition
          if (partition !== targetPartition) {
            console.log(
              `KafkaClient: Ignoring message from partition ${partition}, waiting for partition ${targetPartition}`,
            )
            return
          }

          // If we have a target offset, only process messages at that offset
          if (targetOffset !== null && message.offset !== targetOffset) {
            console.log(`KafkaClient: Ignoring message at offset ${message.offset}, waiting for offset ${targetOffset}`)
            return
          }

          messageReceived = true

          // Store the current position for next time
          if (this.consumerPositions) {
            this.consumerPositions.set(topic, {
              offset: message.offset,
              partition: partition,
            })
            console.log(
              `KafkaClient: Updated position for topic ${topic}: partition ${partition}, offset ${message.offset}`,
            )
          }

          console.log(`KafkaClient: Clearing timeout...`)
          if (timeoutId) {
            clearTimeout(timeoutId)
          }

          try {
            const messageValue = message.value.toString()
            console.log(`KafkaClient: Message value (first 100 chars): ${messageValue.substring(0, 100)}...`)

            // Parse the message based on format
            let parsedMessage
            console.log(`KafkaClient: Parsing message as ${format}...`)

            if (format === 'JSON') {
              try {
                console.log(`KafkaClient: Attempting standard JSON parse...`)
                parsedMessage = JSON.parse(messageValue)
                console.log(`KafkaClient: Standard JSON parse successful`)
              } catch (parseError) {
                console.error(`KafkaClient: Error parsing JSON:`, parseError)

                // Try to fix common JSON issues and parse again
                try {
                  console.log(`KafkaClient: Attempting to fix and parse JSON...`)
                  // Fix unquoted property names (convert property: value to "property": value)
                  const fixedJson = messageValue.replace(/(\s*)(\w+)(\s*):(\s*)/g, '$1"$2"$3:$4')
                  parsedMessage = JSON.parse(fixedJson)
                  console.log(`KafkaClient: Successfully parsed after fixing JSON format`)
                } catch (fixError) {
                  console.error(`KafkaClient: Failed to fix and parse JSON:`, fixError)
                  parsedMessage = {
                    _raw: messageValue,
                    _error: 'Failed to parse as JSON',
                    _note: "The message doesn't contain valid JSON. Property names should be in double quotes.",
                  }
                }
              }
            } else {
              console.log(`KafkaClient: Non-JSON format, returning raw data`)
              parsedMessage = { _raw: messageValue }
            }

            // Add metadata about the message
            parsedMessage._metadata = {
              topic,
              partition,
              offset: message.offset,
              timestamp: message.timestamp,
            }

            // Parse the key if it exists
            if (message.key) {
              try {
                parsedMessage.key = message.key.toString()
              } catch (keyError) {
                console.warn('KafkaClient: Error parsing message key:', keyError)
                parsedMessage.key = null
              }
            } else {
              parsedMessage.key = null
            }

            // Resolve the promise immediately with the parsed message
            console.log(`KafkaClient: Resolving promise with parsed message...`)
            resolve(parsedMessage)
            console.log(`KafkaClient: Promise resolved`)
          } catch (error) {
            console.error(`KafkaClient: Error processing message:`, error)
            resolve({
              _raw: message.value.toString(),
              _error: 'Failed to process message',
              _errorDetails: error instanceof Error ? error.message : String(error),
              _metadata: {
                topic,
                partition,
                offset: message.offset,
                timestamp: message.timestamp,
              },
            })
            console.log(`KafkaClient: Promise resolved with error details`)
          }
        }

        console.log(`KafkaClient: Starting consumer...`)

        // Start the consumer first
        consumer
          ?.run({
            eachMessage: messageHandler,
          })
          .then(() => {
            console.log(`KafkaClient: Consumer run promise resolved`)
          })
          .catch((error) => {
            console.error(`KafkaClient: Error running consumer:`, error)
            reject(error)
          })

        console.log(`KafkaClient: Consumer started, waiting for messages...`)

        // If we have a target offset, seek to it after the consumer is running
        if (targetOffset !== null) {
          // Small delay to ensure consumer is fully initialized
          setTimeout(async () => {
            try {
              console.log(`KafkaClient: Seeking to offset ${targetOffset} in partition ${targetPartition}`)
              await consumer?.seek({
                topic,
                partition: targetPartition,
                offset: targetOffset,
              })
              console.log(`KafkaClient: Successfully seeked to offset`)
            } catch (seekError) {
              console.error(`KafkaClient: Error seeking to offset:`, seekError)
              reject(seekError)
            }
          }, 500) // Give the consumer 500ms to initialize
        }

        // Set a timeout to reject if no message is received
        timeoutId = setTimeout(() => {
          if (!messageReceived) {
            console.log(`KafkaClient: Timeout reached, no messages received after ${Date.now() - startTime}ms`)
            reject(new Error(`Timeout waiting for message from topic: ${topic}`))
          }
        }, 15000) // 15 second timeout
      })

      console.log(`KafkaClient: Waiting for message promise to resolve...`)
      const result = await messagePromise
      console.log(`KafkaClient: Message promise resolved after ${Date.now() - startTime}ms`)
      return result
    } catch (error) {
      console.error(`KafkaClient: Error in fetchSampleEvent:`, error)
      throw error
    } finally {
      // Attempt to disconnect the consumer in a non-blocking way
      if (consumer) {
        console.log(`KafkaClient: Attempting to disconnect consumer...`)

        // Use a timeout to prevent hanging on disconnect
        try {
          const disconnectPromise = Promise.race([
            consumer.disconnect(),
            new Promise((resolve) => setTimeout(resolve, 3000)), // Just resolve after 3 seconds
          ])

          await disconnectPromise
          console.log(`KafkaClient: Consumer disconnected or timeout reached`)
        } catch (disconnectError) {
          console.error(`KafkaClient: Error during consumer disconnect (continuing anyway):`, disconnectError)
        }
      }
    }
  }

  // Fallback method that returns a mock event if real fetching fails
  async fetchSampleEventWithFallback(topic: string, format: string = 'JSON'): Promise<any> {
    try {
      return await this.fetchSampleEvent(topic, format)
    } catch (error) {
      console.warn(`Failed to fetch real event from ${topic}, using mock data:`, error)

      // Return mock data based on format
      if (format === 'JSON') {
        return {
          _mock: true,
          timestamp: new Date().toISOString(),
          topic: topic,
          key: 'sample-key',
          value: {
            id: '12345',
            name: 'Sample Event',
            description: "This is a mock event because we couldn't fetch a real one",
            properties: {
              prop1: 'value1',
              prop2: 42,
              prop3: true,
            },
            createdAt: new Date().toISOString(),
          },
        }
      } else if (format === 'AVRO') {
        return {
          _mock: true,
          _note: 'Mock AVRO data',
          data: { id: '12345', name: 'Sample AVRO Event' },
        }
      } else if (format === 'CSV') {
        return {
          _mock: true,
          _note: 'Mock CSV data',
          _raw: 'id,name,value\n12345,Sample CSV Event,42',
        }
      } else if (format === 'TSV') {
        return {
          _mock: true,
          _note: 'Mock TSV data',
          _raw: 'id\tname\tvalue\n12345\tSample TSV Event\t42',
        }
      } else {
        return {
          _mock: true,
          _raw: 'Sample raw data for ' + topic,
        }
      }
    }
  }
}
