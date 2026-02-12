/**
 * Kafka Client Interface
 *
 * Provides a unified interface for different Kafka client implementations
 * (KafkaJS for most auth methods, kafka-gateway for Kerberos)
 */

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
  serviceName?: string
  krb5Config?: string
  useTicketCache?: boolean
  ticketCachePath?: string

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
  skipTlsVerification?: boolean
}

export interface KafkaMessage {
  topic: string
  partition?: number
  offset?: string
  key?: string | Buffer | null
  value: string | Buffer
  timestamp?: number
  headers?: Record<string, string | Buffer>
}

export interface TopicMetadata {
  name: string
  partitions: Array<{
    id: number
    leader: number
    replicas: number[]
    isr: number[]
  }>
}

export interface IKafkaClient {
  /**
   * Connect to Kafka broker
   */
  connect(): Promise<void>

  /**
   * Disconnect from Kafka broker
   */
  disconnect(): Promise<void>

  /**
   * Send messages to a topic (Producer)
   */
  send(topic: string, messages: KafkaMessage[]): Promise<void>

  /**
   * Subscribe to topics (Consumer)
   */
  subscribe(topics: string[], fromBeginning?: boolean): Promise<void>

  /**
   * Start consuming messages
   */
  consume(callback: (message: KafkaMessage) => void | Promise<void>): Promise<void>

  /**
   * Pause consumption
   */
  pause?(): Promise<void>

  /**
   * Resume consumption
   */
  resume?(): Promise<void>

  /**
   * List all topics
   * @param abortSignal - Optional AbortSignal for cancellation
   */
  listTopics(abortSignal?: AbortSignal): Promise<string[]>

  /**
   * Get metadata for a specific topic
   */
  getTopicMetadata(topic: string): Promise<TopicMetadata>

  /**
   * Get details for all topics (name and partition count)
   * @param abortSignal - Optional AbortSignal for cancellation
   */
  getTopicDetails?(abortSignal?: AbortSignal): Promise<Array<{ name: string; partitionCount: number }>>

  /**
   * Fetch a sample event from a topic
   * @param topic - Topic name
   * @param format - Message format (JSON, AVRO, etc.)
   * @param getNext - Whether to get the next message
   * @param currentOffset - Current offset for navigation
   * @param options - Additional options including abortSignal for cancellation
   */
  fetchSampleEvent?(
    topic: string,
    format?: string,
    getNext?: boolean,
    currentOffset?: string | null,
    options?: {
      position?: 'earliest' | 'latest'
      direction?: 'next' | 'previous'
      partition?: number
      abortSignal?: AbortSignal
    },
  ): Promise<any>

  /**
   * Create a new topic
   */
  createTopic?(topic: string, config?: any): Promise<void>

  /**
   * Test connection to Kafka
   * @param abortSignal - Optional AbortSignal for cancellation
   */
  testConnection(abortSignal?: AbortSignal): Promise<boolean>
}

/**
 * Client type enum for factory
 */
export enum KafkaClientType {
  KAFKAJS = 'kafkajs',
  GATEWAY = 'gateway', // Go-based Kafka Gateway for Kerberos
}

/**
 * Error types
 */
export class KafkaClientError extends Error {
  constructor(
    message: string,
    public code?: string,
    public cause?: Error,
  ) {
    super(message)
    this.name = 'KafkaClientError'
  }
}

export class KafkaConnectionError extends KafkaClientError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONNECTION_ERROR', cause)
    this.name = 'KafkaConnectionError'
  }
}

export class KafkaAuthenticationError extends KafkaClientError {
  constructor(message: string, cause?: Error) {
    super(message, 'AUTHENTICATION_ERROR', cause)
    this.name = 'KafkaAuthenticationError'
  }
}
