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
        case 'NO_AUTH':
          kafkaConfig.sasl = {
            mechanism: 'plain',
          }
          break

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

      // Test connection first
      const isConnected = await this.testConnection()
      if (!isConnected) {
        console.error('KafkaClient: Failed to connect to Kafka')
        throw new Error('Failed to connect to Kafka')
      }

      // Check if topic exists and get partition information
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

        // Try to get offsets for the topic
        const offsets = await admin.fetchTopicOffsets(topic)

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
            } else {
              targetOffset = '0'
            }
          }
        } else if (options?.position === 'earliest') {
          // For earliest, use the low offset
          const partitionInfo = offsets.find((p) => p.partition === targetPartition)
          if (partitionInfo) {
            targetOffset = partitionInfo.low
          }
        } else if (getNext && currentOffset !== null) {
          // For next, use current offset + 1
          targetOffset = (BigInt(currentOffset) + BigInt(1)).toString()
        } else if (options?.direction === 'previous' && currentOffset !== null) {
          // For previous, use current offset - 1, but ensure it's not less than the low offset
          const partitionInfo = offsets.find((p) => p.partition === targetPartition)
          if (partitionInfo) {
            const lowOffset = BigInt(partitionInfo.low)
            const prevOffset = BigInt(currentOffset) - BigInt(1)
            targetOffset = prevOffset < lowOffset ? lowOffset.toString() : prevOffset.toString()
          }
        }
      } finally {
        await admin.disconnect()
      }

      // Use a consistent consumer group ID for the topic to maintain position
      // But add a unique suffix to avoid conflicts with other consumers
      const baseGroupId = `${this.config.groupId || 'sample'}-${topic.replace(/[^a-zA-Z0-9]/g, '-')}`
      const uniqueGroupId = `${baseGroupId}-${Math.random().toString(36).substring(2, 10)}`

      consumer = this.kafka.consumer({
        groupId: uniqueGroupId,
        sessionTimeout: 30000,
      })

      // Set a timeout for the connect operation
      const connectPromise = Promise.race([
        consumer.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout connecting to Kafka')), 5000)),
      ])

      await connectPromise

      // Set a timeout for the subscribe operation
      const subscribePromise = Promise.race([
        consumer.subscribe({ topic, fromBeginning: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout subscribing to topic')), 5000)),
      ])

      await subscribePromise

      // Create a promise that will resolve with the first message or reject after timeout
      const messagePromise = new Promise((resolve, reject) => {
        let timeoutId: NodeJS.Timeout | null = null
        let messageReceived = false

        const messageHandler = async ({ topic, partition, message }: any) => {
          const messageTime = Date.now()

          // Only process messages from the target partition
          if (partition !== targetPartition) {
            return
          }

          // If we have a target offset, check if we should process this message
          if (targetOffset !== null) {
            const messageOffset = BigInt(message.offset)
            const targetOffsetBig = BigInt(targetOffset)

            // For earliest position, accept any message from the earliest offset onwards
            if (options?.position === 'earliest') {
              if (messageOffset < targetOffsetBig) {
                return
              }
            } else {
              // For other positions, require exact offset match
              if (messageOffset !== targetOffsetBig) {
                return
              }
            }
          }

          messageReceived = true

          // Store the current position for next time
          if (this.consumerPositions) {
            this.consumerPositions.set(topic, {
              offset: message.offset,
              partition: partition,
            })
          }

          if (timeoutId) {
            clearTimeout(timeoutId)
          }

          try {
            const messageValue = message.value.toString()

            // Parse the message based on format
            let parsedMessage
            console.log(`KafkaClient: Parsing message with format: "${format}"`)

            if (format === 'JSON' || format === 'json') {
              try {
                parsedMessage = JSON.parse(messageValue)
              } catch (parseError) {
                console.error(`KafkaClient: Error parsing JSON:`, parseError)

                // Try to fix common JSON issues and parse again
                try {
                  // Fix unquoted property names (convert property: value to "property": value)
                  const fixedJson = messageValue.replace(/(\s*)(\w+)(\s*):(\s*)/g, '$1"$2"$3:$4')
                  parsedMessage = JSON.parse(fixedJson)
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
              parsedMessage = { _raw: messageValue }
            }

            // Add metadata about the message
            parsedMessage._metadata = {
              topic,
              partition,
              offset: message.offset,
              timestamp: message.timestamp,
            }

            // Remove the key if it exists - it's related to partitions and not to the event
            if (message.key) {
              try {
                delete parsedMessage.key
              } catch (keyError) {
                console.warn('KafkaClient: Error parsing message key:', keyError)
                parsedMessage.key = undefined
              }
            }

            // Resolve the promise immediately with the parsed message
            resolve(parsedMessage)
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
          }
        }

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

        // If we have a target offset, seek to it after the consumer is running
        if (targetOffset !== null) {
          // Small delay to ensure consumer is fully initialized
          setTimeout(async () => {
            try {
              await consumer?.seek({
                topic,
                partition: targetPartition,
                offset: targetOffset,
              })
            } catch (seekError) {
              console.error(`KafkaClient: Error seeking to offset:`, seekError)
              reject(seekError)
            }
          }, 500) // Give the consumer 500ms to initialize
        }

        // Set a timeout to reject if no message is received
        // Use a longer timeout for earliest position
        const timeoutDuration = options?.position === 'earliest' ? 30000 : 15000
        timeoutId = setTimeout(() => {
          if (!messageReceived) {
            reject(new Error(`Timeout waiting for message from topic: ${topic}`))
          }
        }, timeoutDuration)
      })

      const result = await messagePromise
      return result
    } catch (error) {
      console.error(`KafkaClient: Error in fetchSampleEvent:`, error)
      throw error
    } finally {
      // Attempt to disconnect the consumer in a non-blocking way
      if (consumer) {
        // Use a timeout to prevent hanging on disconnect
        try {
          const disconnectPromise = Promise.race([
            consumer.disconnect(),
            new Promise((resolve) => setTimeout(resolve, 3000)), // Just resolve after 3 seconds
          ])

          await disconnectPromise
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
      if (format === 'JSON' || format === 'json') {
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
      } else if (format === 'AVRO' || format === 'avro') {
        return {
          _mock: true,
          _note: 'Mock AVRO data',
          data: { id: '12345', name: 'Sample AVRO Event' },
        }
      } else if (format === 'CSV' || format === 'csv') {
        return {
          _mock: true,
          _note: 'Mock CSV data',
          _raw: 'id,name,value\n12345,Sample CSV Event,42',
        }
      } else if (format === 'TSV' || format === 'tsv') {
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
