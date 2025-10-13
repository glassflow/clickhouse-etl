/**
 * Kafka Client Interface
 *
 * Provides a unified interface for different Kafka client implementations
 * (KafkaJS for most auth methods, node-rdkafka for Kerberos)
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
   */
  listTopics(): Promise<string[]>

  /**
   * Get metadata for a specific topic
   */
  getTopicMetadata(topic: string): Promise<TopicMetadata>

  /**
   * Get details for all topics (name and partition count)
   */
  getTopicDetails?(): Promise<Array<{ name: string; partitionCount: number }>>

  /**
   * Fetch a sample event from a topic
   */
  fetchSampleEvent?(
    topic: string,
    format?: string,
    getNext?: boolean,
    currentOffset?: string | null,
    options?: any,
  ): Promise<any>

  /**
   * Create a new topic
   */
  createTopic?(topic: string, config?: any): Promise<void>

  /**
   * Test connection to Kafka
   */
  testConnection(): Promise<boolean>
}

/**
 * Client type enum for factory
 */
export enum KafkaClientType {
  KAFKAJS = 'kafkajs',
  RDKAFKA = 'rdkafka',
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
