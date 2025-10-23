/**
 * Kafka Gateway Client
 *
 * Client for interacting with the Go-based Kafka Kerberos Gateway service.
 * This service handles all Kafka operations that require Kerberos (GSSAPI) authentication.
 */

import { IKafkaClient, KafkaConfig, KafkaConnectionError } from './kafka-client-interface'

// Gateway service URL - can be configured via environment variable
const KAFKA_GATEWAY_URL = process.env.KAFKA_GATEWAY_URL || 'http://localhost:8082'

interface GatewayRequest {
  bootstrapServers: string
  securityProtocol: string
  saslMechanism: string
  serviceName: string
  principal: string
  keytab: string // base64 encoded
  krb5Conf: string // base64 encoded
  caCertificate?: string // base64 encoded
}

interface GatewayResponse {
  success: boolean
  error?: string
}

interface TopicsResponse extends GatewayResponse {
  topics?: string[]
}

interface TopicDetailsResponse extends GatewayResponse {
  topicDetails?: Array<{
    name: string
    partitionCount: number
  }>
}

interface SampleEventRequest extends GatewayRequest {
  topic: string
  partition?: number
  maxMessages?: number
  fromBeginning?: boolean
}

interface KafkaEvent {
  topic: string
  partition: number
  offset: number
  key?: string
  value: string
  timestamp: number
  headers?: Record<string, string>
}

interface SampleEventResponse extends GatewayResponse {
  event?: KafkaEvent
  events?: KafkaEvent[]
  hasMoreEvents: boolean
  isAtLatest: boolean
  isAtEarliest: boolean
  isEmptyTopic: boolean
}

export class KafkaGatewayClient implements IKafkaClient {
  private config: KafkaConfig

  constructor(config: KafkaConfig) {
    this.config = config
    console.log('[KafkaGateway] Client initialized')
  }

  /**
   * Build request body for gateway service
   */
  private buildGatewayRequest(): GatewayRequest {
    if (!this.config.kerberosPrincipal || !this.config.kerberosKeytab || !this.config.krb5Config) {
      throw new Error(
        'SASL/GSSAPI configuration is incomplete. Required: kerberosPrincipal, kerberosKeytab, krb5Config',
      )
    }

    // Process keytab: strip data URL prefix if present, keep as base64
    let keytabBase64 = this.config.kerberosKeytab
    if (keytabBase64.startsWith('data:')) {
      // Extract base64 content from data URL: "data:application/octet-stream;base64,<content>"
      const parts = keytabBase64.split(',')
      if (parts.length > 1) {
        keytabBase64 = parts[1]
        console.log('[KafkaGateway] Extracted base64 keytab from data URL')
      }
    }

    // Process krb5.conf: convert to base64 if needed
    let krb5ConfBase64 = this.config.krb5Config
    if (krb5ConfBase64.startsWith('data:')) {
      // If it's a data URL, extract the base64 content
      const parts = krb5ConfBase64.split(',')
      if (parts.length > 1) {
        if (parts[0].includes('base64')) {
          // Already base64, just extract it
          krb5ConfBase64 = parts[1]
        } else {
          // URL-encoded text, decode then re-encode as base64
          const text = decodeURIComponent(parts[1])
          krb5ConfBase64 = Buffer.from(text, 'utf-8').toString('base64')
        }
        console.log('[KafkaGateway] Extracted krb5.conf from data URL')
      }
    } else if (!this.isBase64(krb5ConfBase64)) {
      // If it's plain text, encode it to base64
      krb5ConfBase64 = Buffer.from(krb5ConfBase64, 'utf-8').toString('base64')
      console.log('[KafkaGateway] Encoded krb5.conf to base64')
    }

    // Extract CA certificate from truststore and encode as base64
    let caCertificateBase64: string | undefined
    let caCertificate: string | undefined

    if (this.config.truststore?.certificates) {
      // If certificates is an array, join them
      if (Array.isArray(this.config.truststore.certificates)) {
        caCertificate = this.config.truststore.certificates.join('\n')
      } else {
        caCertificate = this.config.truststore.certificates
      }
    } else if (this.config.certificate) {
      caCertificate = this.config.certificate
    }

    // Process CA certificate: convert to base64 if needed
    if (caCertificate) {
      if (caCertificate.startsWith('data:')) {
        const parts = caCertificate.split(',')
        if (parts.length > 1) {
          if (parts[0].includes('base64')) {
            // Already base64
            caCertificateBase64 = parts[1]
          } else {
            // URL-encoded, decode then re-encode
            const text = decodeURIComponent(parts[1])
            caCertificateBase64 = Buffer.from(text, 'utf-8').toString('base64')
          }
          console.log('[KafkaGateway] Extracted CA certificate from data URL')
        }
      } else if (!this.isBase64(caCertificate)) {
        // If it's plain text (PEM format), encode to base64
        caCertificateBase64 = Buffer.from(caCertificate, 'utf-8').toString('base64')
        console.log('[KafkaGateway] Encoded CA certificate to base64')
      } else {
        caCertificateBase64 = caCertificate
      }
    }

    return {
      bootstrapServers: this.config.brokers.join(','),
      securityProtocol: this.config.securityProtocol || 'SASL_SSL',
      saslMechanism: 'GSSAPI',
      serviceName: this.config.serviceName || 'kafka',
      principal: this.config.kerberosPrincipal,
      keytab: keytabBase64,
      krb5Conf: krb5ConfBase64,
      caCertificate: caCertificateBase64,
    }
  }

  /**
   * Check if a string is likely base64 encoded
   */
  private isBase64(str: string): boolean {
    // Simple heuristic: base64 strings only contain A-Z, a-z, 0-9, +, /, and = for padding
    // and typically don't contain newlines (except in PEM format which has -----BEGIN/END-----)
    if (str.includes('-----BEGIN')) {
      // PEM format certificates/keys are NOT base64-only, they're text
      return false
    }
    // Test if it's valid base64 by attempting to decode
    try {
      return Buffer.from(str, 'base64').toString('base64') === str
    } catch {
      return false
    }
  }

  /**
   * Make HTTP request to gateway service
   */
  private async callGateway<T extends GatewayResponse>(endpoint: string, requestBody: GatewayRequest): Promise<T> {
    try {
      const response = await fetch(`${KAFKA_GATEWAY_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        // Increase timeout for Kerberos operations
        signal: AbortSignal.timeout(60000), // 60 seconds
      })

      if (!response.ok) {
        throw new Error(`Gateway returned ${response.status}: ${response.statusText}`)
      }

      const data: T = await response.json()

      if (!data.success) {
        throw new KafkaConnectionError(data.error || 'Unknown gateway error')
      }

      return data
    } catch (error) {
      if (error instanceof KafkaConnectionError) {
        throw error
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          throw new KafkaConnectionError('Request to Kafka gateway timed out')
        }
        throw new KafkaConnectionError(`Gateway communication failed: ${error.message}`)
      }

      throw new KafkaConnectionError('Unknown error communicating with Kafka gateway')
    }
  }

  /**
   * Connect to Kafka (no-op for HTTP gateway client)
   */
  async connect(): Promise<void> {
    console.log('[KafkaGateway] Connect called (no-op for HTTP client)')
  }

  /**
   * Test connection to Kafka cluster via gateway
   */
  async testConnection(): Promise<boolean> {
    console.log('[KafkaGateway] Testing connection via gateway service')

    try {
      const requestBody = this.buildGatewayRequest()
      await this.callGateway<GatewayResponse>('/kafka/test-connection', requestBody)
      console.log('[KafkaGateway] Connection test successful')
      return true
    } catch (error) {
      console.error('[KafkaGateway] Connection test failed:', error)
      return false
    }
  }

  /**
   * Send messages (not supported via gateway - use direct producer)
   */
  async send(topic: string, messages: any[]): Promise<void> {
    throw new Error('Message sending via gateway is not supported. Use a direct producer.')
  }

  /**
   * Subscribe to topics (not supported via gateway - use direct consumer)
   */
  async subscribe(topics: string[], fromBeginning?: boolean): Promise<void> {
    throw new Error('Topic subscription via gateway is not supported. Use a direct consumer.')
  }

  /**
   * Consume messages (not supported via gateway - use direct consumer)
   */
  async consume(callback: (message: any) => void | Promise<void>): Promise<void> {
    throw new Error('Message consumption via gateway is not supported. Use a direct consumer.')
  }

  /**
   * Get metadata for a specific topic
   */
  async getTopicMetadata(topic: string): Promise<any> {
    console.log(`[KafkaGateway] Fetching metadata for topic: ${topic}`)

    // Get all topic details and find the requested topic
    const allTopics = await this.getTopicDetails()
    const topicDetail = allTopics.find((t) => t.name === topic)

    if (!topicDetail) {
      throw new KafkaConnectionError(`Topic '${topic}' not found`)
    }

    return {
      name: topicDetail.name,
      partitions: topicDetail.partitionCount,
    }
  }

  /**
   * List all Kafka topics via gateway
   */
  async listTopics(): Promise<string[]> {
    console.log('[KafkaGateway] Fetching topics via gateway service')

    const requestBody = this.buildGatewayRequest()
    const response = await this.callGateway<TopicsResponse>('/kafka/topics', requestBody)

    if (!response.topics) {
      throw new KafkaConnectionError('Gateway returned no topics')
    }

    console.log(`[KafkaGateway] Retrieved ${response.topics.length} topics`)
    return response.topics
  }

  /**
   * Get details for all topics via gateway
   */
  async getTopicDetails(): Promise<Array<{ name: string; partitionCount: number }>> {
    console.log('[KafkaGateway] Fetching topic details via gateway service')

    const requestBody = this.buildGatewayRequest()
    const response = await this.callGateway<TopicDetailsResponse>('/kafka/topic-details', requestBody)

    if (!response.topicDetails) {
      throw new KafkaConnectionError('Gateway returned no topic details')
    }

    console.log(`[KafkaGateway] Retrieved details for ${response.topicDetails.length} topics`)
    return response.topicDetails
  }

  /**
   * Fetch sample event from a topic
   */
  async fetchSampleEvent(
    topic: string,
    format?: string,
    getNext?: boolean,
    currentOffset?: string | null,
    options?: any,
  ): Promise<any> {
    console.log(`[KafkaGateway] Fetching sample event from topic: ${topic}`)

    const requestBody: SampleEventRequest = {
      ...this.buildGatewayRequest(),
      topic,
      partition: options?.partition || 0,
      maxMessages: 1,
      fromBeginning: !getNext,
    }

    const response = await this.callGateway<SampleEventResponse>('/kafka/sample-events', requestBody)

    console.log(`[KafkaGateway] Fetched event from topic ${topic}`)

    // Parse the event value (it's a JSON string) and return ONLY the parsed data
    if (response.event) {
      try {
        // Try to parse the value as JSON and return it directly
        return JSON.parse(response.event.value)
      } catch (error) {
        // If parsing fails, return the raw value as a string
        console.warn('[KafkaGateway] Failed to parse event value as JSON, using raw value')
        return response.event.value
      }
    }

    // If no event, return null
    return null
  }

  /**
   * Create a new topic (not implemented yet in gateway)
   */
  async createTopic(topic: string, config?: any): Promise<void> {
    throw new Error('Topic creation via gateway is not yet implemented')
  }

  /**
   * Disconnect (no-op for HTTP client)
   */
  async disconnect(): Promise<void> {
    console.log('[KafkaGateway] Disconnect called (no-op for HTTP client)')
  }

  /**
   * Check if gateway service is healthy
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${KAFKA_GATEWAY_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      return data.status === 'healthy'
    } catch (error) {
      console.error('[KafkaGateway] Health check failed:', error)
      return false
    }
  }
}
