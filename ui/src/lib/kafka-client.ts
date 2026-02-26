import { Kafka, Consumer, Admin, logLevel, KafkaMessage } from 'kafkajs'
import { createAwsIamMechanism } from '../utils/common.server'
import { KafkaConfig } from './kafka-client-interface'

// Re-export KafkaConfig for backwards compatibility
export type { KafkaConfig } from './kafka-client-interface'

export interface KafkaEvent {
  topic: string
  partition: number
  offset: string
  timestamp: string
  key: string | null
  value: any
  headers?: Record<string, string>
}

// ============================================================================
// Circuit Breaker Implementation
// ============================================================================

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation, requests flow through
  OPEN = 'OPEN', // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold: number // Number of failures before opening circuit
  resetTimeoutMs: number // Time to wait before trying again (half-open)
  halfOpenMaxAttempts: number // Max attempts in half-open state
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount: number = 0
  private lastFailureTime: number = 0
  private halfOpenAttempts: number = 0
  private readonly options: CircuitBreakerOptions

  constructor(options?: Partial<CircuitBreakerOptions>) {
    this.options = {
      failureThreshold: options?.failureThreshold ?? 5,
      resetTimeoutMs: options?.resetTimeoutMs ?? 30000, // 30 seconds
      halfOpenMaxAttempts: options?.halfOpenMaxAttempts ?? 2,
    }
  }

  get currentState(): CircuitState {
    return this.state
  }

  get failures(): number {
    return this.failureCount
  }

  /**
   * Check if request should be allowed through
   */
  canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true
    }

    if (this.state === CircuitState.OPEN) {
      // Check if enough time has passed to try again
      const now = Date.now()
      if (now - this.lastFailureTime >= this.options.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN
        this.halfOpenAttempts = 0
        console.log('[CircuitBreaker] Transitioning to HALF_OPEN state')
        return true
      }
      return false
    }

    // HALF_OPEN state - allow limited attempts
    return this.halfOpenAttempts < this.options.halfOpenMaxAttempts
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      // Service recovered, close the circuit
      console.log('[CircuitBreaker] Success in HALF_OPEN state, closing circuit')
      this.state = CircuitState.CLOSED
      this.failureCount = 0
      this.halfOpenAttempts = 0
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.lastFailureTime = Date.now()

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++
      if (this.halfOpenAttempts >= this.options.halfOpenMaxAttempts) {
        // Still failing, reopen circuit
        console.log('[CircuitBreaker] Failed in HALF_OPEN state, reopening circuit')
        this.state = CircuitState.OPEN
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount++
      if (this.failureCount >= this.options.failureThreshold) {
        console.log(`[CircuitBreaker] Failure threshold (${this.options.failureThreshold}) reached, opening circuit`)
        this.state = CircuitState.OPEN
      }
    }
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.halfOpenAttempts = 0
    this.lastFailureTime = 0
  }

  /**
   * Get time remaining until circuit breaker allows retry (in ms)
   * Returns 0 if circuit is not open
   */
  getTimeUntilRetry(): number {
    if (this.state !== CircuitState.OPEN) {
      return 0
    }
    const elapsed = Date.now() - this.lastFailureTime
    return Math.max(0, this.options.resetTimeoutMs - elapsed)
  }
}

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

export interface RetryOptions {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableErrors?: string[] // Error message patterns that should trigger retry
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'Request timed out',
    'Connection error',
    'The coordinator is not aware of this member',
    'Broker not available',
    'Leader not available',
  ],
}

/**
 * Check if an error is retryable based on its message
 */
export function isRetryableError(error: Error, retryablePatterns: string[]): boolean {
  const errorMessage = error.message || ''
  const errorName = error.name || ''

  return retryablePatterns.some((pattern) => errorMessage.includes(pattern) || errorName.includes(pattern))
}

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  abortSignal?: AbortSignal,
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: Error | null = null
  let delay = opts.initialDelayMs

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    // Check if operation was aborted
    if (abortSignal?.aborted) {
      throw new Error('Operation aborted')
    }

    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry if this isn't a retryable error
      if (!isRetryableError(lastError, opts.retryableErrors || [])) {
        throw lastError
      }

      // Don't retry if we've exhausted attempts
      if (attempt === opts.maxRetries) {
        console.error(`[Retry] All ${opts.maxRetries} retries exhausted`)
        throw lastError
      }

      console.log(`[Retry] Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`)

      // Wait before retrying
      await sleep(delay)

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs)
    }
  }

  throw lastError || new Error('Retry failed with unknown error')
}

// ============================================================================
// Consumer Tracker for Orphaned Consumer Cleanup
// ============================================================================

export interface TrackedConsumer {
  consumer: Consumer
  groupId: string
  createdAt: number
  topic: string
  disconnectPromise?: Promise<void>
  adminClient?: Admin // Reference to admin client for consumer group deletion
}

export class ConsumerTracker {
  private consumers: Map<string, TrackedConsumer> = new Map()
  private readonly maxAge: number = 60000 // 60 seconds max age for orphaned consumers
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Start periodic cleanup
    this.startPeriodicCleanup()
  }

  /**
   * Track a new consumer
   * @param id - Unique identifier for this consumer
   * @param consumer - The Kafka consumer instance
   * @param groupId - The consumer group ID (used for cleanup)
   * @param topic - The topic being consumed
   * @param adminClient - Optional admin client for consumer group deletion
   */
  track(id: string, consumer: Consumer, groupId: string, topic: string, adminClient?: Admin): void {
    this.consumers.set(id, {
      consumer,
      groupId,
      createdAt: Date.now(),
      topic,
      adminClient,
    })
    console.log(`[ConsumerTracker] Tracking consumer ${id} for topic ${topic}`)
  }

  /**
   * Mark a consumer as disconnecting (started disconnect process)
   */
  markDisconnecting(id: string, disconnectPromise: Promise<void>): void {
    const tracked = this.consumers.get(id)
    if (tracked) {
      tracked.disconnectPromise = disconnectPromise
    }
  }

  /**
   * Remove a consumer from tracking (successfully disconnected)
   */
  untrack(id: string): void {
    this.consumers.delete(id)
    console.log(`[ConsumerTracker] Untracked consumer ${id}`)
  }

  /**
   * Get count of tracked consumers
   */
  get count(): number {
    return this.consumers.size
  }

  /**
   * Start periodic cleanup of orphaned consumers
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupInterval) return

    this.cleanupInterval = setInterval(() => {
      this.cleanupOrphanedConsumers()
    }, 30000) // Run cleanup every 30 seconds

    // Ensure cleanup doesn't prevent process exit (Node.js only; no-op in browser)
    const interval = this.cleanupInterval as unknown as NodeJS.Timeout | null
    if (interval?.unref) interval.unref()
  }

  /**
   * Clean up consumers that have been around too long
   */
  async cleanupOrphanedConsumers(): Promise<void> {
    const now = Date.now()
    const orphaned: string[] = []

    for (const [id, tracked] of this.consumers.entries()) {
      if (now - tracked.createdAt > this.maxAge) {
        orphaned.push(id)
      }
    }

    if (orphaned.length > 0) {
      console.log(`[ConsumerTracker] Cleaning up ${orphaned.length} orphaned consumers`)
    }

    for (const id of orphaned) {
      await this.forceDisconnect(id)
    }
  }

  /**
   * Force disconnect a consumer and delete its consumer group
   */
  async forceDisconnect(id: string): Promise<void> {
    const tracked = this.consumers.get(id)
    if (!tracked) return

    console.log(`[ConsumerTracker] Force disconnecting consumer ${id}`)

    try {
      // If already disconnecting, wait for that
      if (tracked.disconnectPromise) {
        await Promise.race([
          tracked.disconnectPromise,
          sleep(2000), // Max 2 seconds wait
        ])
      } else {
        // Try to disconnect with a short timeout
        await Promise.race([tracked.consumer.disconnect(), sleep(2000)])
      }
    } catch (error) {
      console.error(`[ConsumerTracker] Error force disconnecting consumer ${id}:`, error)
    }

    // Delete the consumer group (best-effort); many brokers don't support or allow DeleteGroups.
    if (tracked.adminClient && tracked.groupId) {
      try {
        await Promise.race([
          tracked.adminClient.deleteGroups([tracked.groupId]),
          sleep(3000), // Max 3 seconds for group deletion
        ])
        console.log(`[ConsumerTracker] Deleted consumer group: ${tracked.groupId}`)
      } catch (deleteError: unknown) {
        const isDeleteGroupsError =
          deleteError &&
          typeof deleteError === 'object' &&
          (deleteError as { name?: string }).name === 'KafkaJSDeleteGroupsError'
        if (isDeleteGroupsError) {
          console.info(
            `[ConsumerTracker] Consumer group ${tracked.groupId} could not be deleted (broker may not support or allow it).`,
          )
        } else {
          console.warn(`[ConsumerTracker] Failed to delete consumer group ${tracked.groupId}:`, deleteError)
        }
      }
    }

    // Always remove from tracking
    this.consumers.delete(id)
  }

  /**
   * Clean up all tracked consumers (for shutdown)
   */
  async cleanupAll(): Promise<void> {
    console.log(`[ConsumerTracker] Cleaning up all ${this.consumers.size} tracked consumers`)

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    const disconnectPromises = Array.from(this.consumers.keys()).map((id) => this.forceDisconnect(id))

    await Promise.allSettled(disconnectPromises)
  }

  /**
   * Stop the tracker (for cleanup)
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Global consumer tracker instance
const globalConsumerTracker = new ConsumerTracker()

export class KafkaClient {
  private kafka: Kafka
  private consumer: Consumer | null = null
  private adminClient: Admin | null = null
  private adminClientConnected: boolean = false
  private config: KafkaConfig

  // Circuit breaker for connection failures
  private circuitBreaker: CircuitBreaker

  // Retry options (can be customized per instance)
  private retryOptions: Partial<RetryOptions>

  constructor(
    config: KafkaConfig,
    options?: {
      circuitBreakerOptions?: Partial<CircuitBreakerOptions>
      retryOptions?: Partial<RetryOptions>
    },
  ) {
    this.config = config
    this.circuitBreaker = new CircuitBreaker(options?.circuitBreakerOptions)
    this.retryOptions = options?.retryOptions || {}

    // Determine log level from environment variable
    // Supported values: NOTHING, ERROR, WARN, INFO, DEBUG (default: ERROR for production)
    const kafkaLogLevelStr = process.env.KAFKA_LOG_LEVEL?.toUpperCase() || 'ERROR'
    const kafkaLogLevel = (() => {
      switch (kafkaLogLevelStr) {
        case 'NOTHING':
          return logLevel.NOTHING
        case 'ERROR':
          return logLevel.ERROR
        case 'WARN':
          return logLevel.WARN
        case 'INFO':
          return logLevel.INFO
        case 'DEBUG':
          return logLevel.DEBUG
        default:
          return logLevel.ERROR // Default to ERROR for performance in production
      }
    })()

    // Base Kafka configuration
    const kafkaConfig: any = {
      clientId: config.clientId || 'kafka-client',
      brokers: config.brokers,
      logLevel: kafkaLogLevel,
    }

    // Configure SSL
    if (config.securityProtocol === 'SASL_SSL' || config.securityProtocol === 'SSL') {
      kafkaConfig.ssl = {
        rejectUnauthorized: config.skipTlsVerification ? false : true, // Skip TLS verification if enabled
        ca: config.certificate ? [config.certificate] : undefined,
        checkServerIdentity: config.skipTlsVerification ? () => undefined : undefined, // Disable hostname verification if skip is enabled
      }

      // Handle truststore configuration for SSL
      if (config.truststore) {
        // For Node.js/KafkaJS, we need to handle truststore differently
        // Since KafkaJS doesn't directly support JKS files, we use certificates
        if (config.truststore.certificates) {
          kafkaConfig.ssl.ca = [config.truststore.certificates]
        }

        // Handle self-signed certificates by disabling certificate verification
        // when algorithm is empty (which indicates self-signed certs)
        if (config.truststore.algorithm === '' || !config.truststore.algorithm) {
          kafkaConfig.ssl.rejectUnauthorized = false
        }
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
            serviceName: config.serviceName,
            krb5Config: config.krb5Config,
            useTicketCache: config.useTicketCache,
            ticketCachePath: config.ticketCachePath,
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

  /**
   * Check circuit breaker and throw if open
   */
  private checkCircuitBreaker(): void {
    if (!this.circuitBreaker.canExecute()) {
      const retryIn = this.circuitBreaker.getTimeUntilRetry()
      throw new Error(
        `Circuit breaker is open due to repeated failures. Retry in ${Math.ceil(retryIn / 1000)} seconds.`,
      )
    }
  }

  /**
   * Get a pooled admin client instance. Creates and connects on first call,
   * reuses the connection on subsequent calls. This avoids the overhead of
   * creating a new admin client and TCP/SASL handshake for every operation.
   *
   * Uses circuit breaker to prevent repeated connection attempts to a failing broker.
   * Uses retry logic with exponential backoff for transient failures.
   */
  private async getAdminClient(abortSignal?: AbortSignal): Promise<Admin> {
    // Check circuit breaker first
    this.checkCircuitBreaker()

    if (!this.adminClient) {
      this.adminClient = this.kafka.admin()
    }

    if (!this.adminClientConnected) {
      try {
        await withRetry(
          async () => {
            if (abortSignal?.aborted) {
              throw new Error('Operation aborted')
            }
            await this.adminClient!.connect()
          },
          this.retryOptions,
          abortSignal,
        )
        this.adminClientConnected = true
        this.circuitBreaker.recordSuccess()
      } catch (error) {
        this.circuitBreaker.recordFailure()
        throw error
      }
    }

    return this.adminClient
  }

  /**
   * Disconnect the pooled admin client. Call this when done with admin operations
   * or when the KafkaClient is being disposed.
   */
  private async disconnectAdminClient(): Promise<void> {
    if (this.adminClient && this.adminClientConnected) {
      try {
        await Promise.race([
          this.adminClient.disconnect(),
          sleep(5000), // Max 5 seconds for disconnect
        ])
      } catch (error) {
        console.error('Error disconnecting admin client:', error)
      }
      this.adminClientConnected = false
    }
  }

  /**
   * Test connection to Kafka broker.
   * Uses circuit breaker and retry logic for robustness.
   */
  async testConnection(abortSignal?: AbortSignal): Promise<boolean> {
    try {
      const admin = await this.getAdminClient(abortSignal)
      await withRetry(() => admin.listTopics(), this.retryOptions, abortSignal)
      this.circuitBreaker.recordSuccess()
      return true
    } catch (error) {
      console.error('Failed to connect to Kafka:', error)
      // Reset connection state on failure so next attempt will reconnect
      this.adminClientConnected = false
      this.circuitBreaker.recordFailure()
      return false
    }
  }

  /**
   * List all topics from Kafka.
   * Uses circuit breaker and retry logic for robustness.
   */
  async listTopics(abortSignal?: AbortSignal): Promise<string[]> {
    try {
      const admin = await this.getAdminClient(abortSignal)
      const metadata = await withRetry(() => admin.fetchTopicMetadata(), this.retryOptions, abortSignal)
      const topics = metadata.topics.map((topic) => topic.name)
      this.circuitBreaker.recordSuccess()
      return topics
    } catch (error) {
      console.error('Error listing Kafka topics:', error)
      // Reset connection state on failure
      this.adminClientConnected = false
      this.circuitBreaker.recordFailure()
      throw error
    }
  }

  /**
   * Get details for all topics including partition count.
   * Uses circuit breaker and retry logic for robustness.
   */
  async getTopicDetails(abortSignal?: AbortSignal): Promise<Array<{ name: string; partitionCount: number }>> {
    try {
      const admin = await this.getAdminClient(abortSignal)
      const metadata = await withRetry(() => admin.fetchTopicMetadata(), this.retryOptions, abortSignal)
      const topicDetails = metadata.topics.map((topic) => ({
        name: topic.name,
        partitionCount: topic.partitions.length,
      }))
      this.circuitBreaker.recordSuccess()
      return topicDetails
    } catch (error) {
      console.error('Error fetching topic details:', error)
      // Reset connection state on failure
      this.adminClientConnected = false
      this.circuitBreaker.recordFailure()
      throw error
    }
  }

  /**
   * Get current circuit breaker state (for monitoring/debugging)
   */
  getCircuitBreakerState(): { state: CircuitState; failures: number; timeUntilRetry: number } {
    return {
      state: this.circuitBreaker.currentState,
      failures: this.circuitBreaker.failures,
      timeUntilRetry: this.circuitBreaker.getTimeUntilRetry(),
    }
  }

  /**
   * Reset circuit breaker (use carefully, mainly for testing)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset()
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
    // Disconnect the pooled admin client
    await this.disconnectAdminClient()

    // Disconnect the consumer if it exists
    if (this.consumer) {
      try {
        await Promise.race([
          this.consumer.disconnect(),
          sleep(5000), // Max 5 seconds
        ])
      } catch (error) {
        console.error('Error disconnecting consumer:', error)
      }
      this.consumer = null
    }
  }

  /**
   * Get count of tracked consumers across all KafkaClient instances
   */
  static getTrackedConsumerCount(): number {
    return globalConsumerTracker.count
  }

  /**
   * Force cleanup of all orphaned consumers (useful for graceful shutdown)
   */
  static async cleanupAllConsumers(): Promise<void> {
    await globalConsumerTracker.cleanupAll()
  }

  /**
   * Stop the consumer tracker (call on application shutdown)
   */
  static stopConsumerTracker(): void {
    globalConsumerTracker.stop()
  }

  /**
   * Fetch a sample event from a Kafka topic.
   *
   * Features:
   * - Circuit breaker to prevent repeated failures
   * - Retry logic with exponential backoff for transient errors
   * - AbortController support for cascading cancellation
   * - Proper event listener cleanup to prevent memory leaks
   * - Consumer tracking for orphaned consumer cleanup
   */
  async fetchSampleEvent(
    topic: string,
    format: string = 'JSON',
    getNext: boolean = false,
    currentOffset: string | null = null,
    options?: {
      position?: 'earliest' | 'latest'
      direction?: 'next' | 'previous'
      partition?: number
      abortSignal?: AbortSignal
    },
  ): Promise<any> {
    // Check circuit breaker first
    this.checkCircuitBreaker()

    let consumer: Consumer | null = null
    let consumerId: string | null = null
    let groupJoinUnsubscribe: (() => void) | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    // Create internal abort controller that can be triggered by external signal or timeout
    const internalAbortController = new AbortController()
    const abortSignal = options?.abortSignal

    // Link external abort signal to internal one
    if (abortSignal) {
      if (abortSignal.aborted) {
        throw new Error('Operation aborted before starting')
      }
      abortSignal.addEventListener('abort', () => {
        internalAbortController.abort()
      })
    }

    // Cleanup function to ensure all resources are released
    const cleanup = async () => {
      // Clear timeout first
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // Unsubscribe from GROUP_JOIN event
      if (groupJoinUnsubscribe) {
        try {
          groupJoinUnsubscribe()
        } catch (e) {
          // Ignore errors from unsubscribe
        }
        groupJoinUnsubscribe = null
      }

      // Store consumerId for group deletion after disconnect
      const groupIdToDelete = consumerId

      // Disconnect consumer with tracking
      if (consumer && consumerId) {
        const disconnectPromise = (async () => {
          try {
            await Promise.race([
              consumer!.disconnect(),
              sleep(3000), // Max 3 seconds for disconnect
            ])
            globalConsumerTracker.untrack(consumerId!)
          } catch (disconnectError) {
            console.error(`KafkaClient: Error during consumer disconnect:`, disconnectError)
            // Consumer will be cleaned up by tracker eventually
          }
        })()

        globalConsumerTracker.markDisconnecting(consumerId, disconnectPromise)
        await disconnectPromise
      }

      // Delete the consumer group from the broker to prevent orphaned groups (best-effort only).
      // This must happen AFTER the consumer disconnects. Many brokers don't support DeleteGroups
      // or deny it via ACLs; the sample fetch has already succeeded, so we never throw here.
      if (groupIdToDelete && this.adminClient && this.adminClientConnected) {
        try {
          await Promise.race([
            this.adminClient.deleteGroups([groupIdToDelete]),
            sleep(5000), // Max 5 seconds for group deletion
          ])
          console.log(`[KafkaClient] Deleted consumer group: ${groupIdToDelete}`)
        } catch (deleteError: unknown) {
          const isDeleteGroupsError =
            deleteError &&
            typeof deleteError === 'object' &&
            (deleteError as { name?: string }).name === 'KafkaJSDeleteGroupsError'
          if (isDeleteGroupsError) {
            // Expected when broker doesn't support DeleteGroups or ACLs deny it; sample fetch succeeded.
            console.info(
              `[KafkaClient] Consumer group ${groupIdToDelete} could not be deleted (broker may not support or allow it); sample fetch succeeded.`,
            )
          } else {
            console.warn(`[KafkaClient] Failed to delete consumer group ${groupIdToDelete}:`, deleteError)
          }
        }
      }
    }

    try {
      // Use pooled admin client for metadata operations (avoids connection overhead)
      const admin = await this.getAdminClient(internalAbortController.signal)

      let targetPartition = options?.partition !== undefined ? options.partition : 0
      let targetOffset: string | null = null

      // Get topic metadata with retry
      const metadata = await withRetry(
        () => admin.fetchTopicMetadata({ topics: [topic] }),
        this.retryOptions,
        internalAbortController.signal,
      )

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

      // Try to get offsets for the topic with retry
      const offsets = await withRetry(
        () => admin.fetchTopicOffsets(topic),
        this.retryOptions,
        internalAbortController.signal,
      )

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
          const lowOffset = parseInt(partitionInfo.low, 10)
          console.log(`KafkaClient: Partition ${targetPartition} offsets - low: ${lowOffset}, high: ${highOffset}`)
          if (highOffset > 0) {
            targetOffset = (highOffset - 1).toString()
          } else {
            targetOffset = '0'
          }
          console.log(`KafkaClient: Set targetOffset for 'latest': ${targetOffset}`)
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

      // Generate unique consumer group ID
      const baseGroupId = `${this.config.groupId || 'sample'}-${topic.replace(/[^a-zA-Z0-9]/g, '-')}`
      consumerId = `${baseGroupId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`

      // Configure consumer with optimized settings for sample fetching
      const connectTimeoutMs = parseInt(process.env.KAFKA_CONNECT_TIMEOUT_MS ?? '', 10) || 10000
      const sessionTimeoutMs = parseInt(process.env.KAFKA_SESSION_TIMEOUT_MS ?? '', 10) || 45000

      consumer = this.kafka.consumer({
        groupId: consumerId,
        sessionTimeout: sessionTimeoutMs,
        heartbeatInterval: Math.floor(sessionTimeoutMs / 4),
        maxWaitTimeInMs: 5000,
        maxBytes: 1048576,
      })

      // Track this consumer for cleanup (pass admin client for group deletion on orphan cleanup)
      globalConsumerTracker.track(consumerId, consumer, consumerId, topic, this.adminClient || undefined)

      // Check abort before connect
      if (internalAbortController.signal.aborted) {
        throw new Error('Operation aborted')
      }

      // Connect with retry and timeout
      await withRetry(
        async () => {
          if (internalAbortController.signal.aborted) {
            throw new Error('Operation aborted')
          }
          await Promise.race([
            consumer!.connect(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout connecting to Kafka')), connectTimeoutMs),
            ),
          ])
        },
        { ...this.retryOptions, maxRetries: 2 },
        internalAbortController.signal,
      )

      // Check abort before subscribe
      if (internalAbortController.signal.aborted) {
        throw new Error('Operation aborted')
      }

      // Subscribe with timeout
      await Promise.race([
        consumer.subscribe({ topic, fromBeginning: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout subscribing to topic')), 10000)),
      ])

      // Create a promise that will resolve with the first message or reject after timeout
      const messagePromise = new Promise((resolve, reject) => {
        let messageReceived = false

        // Handle abort signal
        const abortHandler = () => {
          if (!messageReceived) {
            reject(new Error('Operation aborted'))
          }
        }
        internalAbortController.signal.addEventListener('abort', abortHandler)

        const messageHandler = async ({ topic: msgTopic, partition, message }: any) => {
          console.log(
            `KafkaClient: Received message - topic: ${msgTopic}, partition: ${partition}, offset: ${message.offset}, targetPartition: ${targetPartition}, targetOffset: ${targetOffset}`,
          )

          // Only process messages from the target partition
          if (partition !== targetPartition) {
            console.log(`KafkaClient: Skipping message - wrong partition (${partition} !== ${targetPartition})`)
            return
          }

          // If we have a target offset, check if we should process this message
          if (targetOffset !== null) {
            const messageOffset = BigInt(message.offset)
            const targetOffsetBig = BigInt(targetOffset)

            console.log(
              `KafkaClient: Checking offset - messageOffset: ${messageOffset}, targetOffset: ${targetOffsetBig}, position: ${options?.position}`,
            )

            if (options?.position === 'earliest') {
              if (messageOffset < targetOffsetBig) {
                console.log(`KafkaClient: Skipping message - offset too low for earliest`)
                return
              }
            } else {
              if (messageOffset !== targetOffsetBig) {
                console.log(`KafkaClient: Skipping message - offset mismatch (${messageOffset} !== ${targetOffsetBig})`)
                return
              }
            }
          }

          console.log(`KafkaClient: ACCEPTING message at offset ${message.offset}`)

          messageReceived = true

          // Clear timeout since we got a message
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }

          // Remove abort handler
          internalAbortController.signal.removeEventListener('abort', abortHandler)

          try {
            const messageValue = message.value.toString()
            let parsedMessage

            if (format === 'JSON' || format === 'json') {
              try {
                parsedMessage = JSON.parse(messageValue)
              } catch (parseError) {
                console.error(`KafkaClient: Error parsing JSON:`, parseError)
                try {
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

            parsedMessage._metadata = {
              topic: msgTopic,
              partition,
              offset: message.offset,
              timestamp: message.timestamp,
            }

            if (message.key) {
              try {
                delete parsedMessage.key
              } catch (keyError) {
                console.warn('KafkaClient: Error parsing message key:', keyError)
                parsedMessage.key = undefined
              }
            }

            resolve(parsedMessage)
          } catch (error) {
            console.error(`KafkaClient: Error processing message:`, error)
            resolve({
              _raw: message.value.toString(),
              _error: 'Failed to process message',
              _errorDetails: error instanceof Error ? error.message : String(error),
              _metadata: {
                topic: msgTopic,
                partition,
                offset: message.offset,
                timestamp: message.timestamp,
              },
            })
          }
        }

        // Start the consumer
        consumer
          ?.run({
            eachMessage: messageHandler,
          })
          .catch((error) => {
            console.error(`KafkaClient: Error running consumer:`, error)
            reject(error)
          })

        // Setup GROUP_JOIN listener if we need to seek
        if (targetOffset !== null && consumer) {
          console.log(`KafkaClient: Setting up GROUP_JOIN listener to seek after partition assignment`)

          // Store unsubscribe function for cleanup
          groupJoinUnsubscribe = consumer.on(consumer.events.GROUP_JOIN, ({ payload }: any) => {
            console.log(
              `KafkaClient: GROUP_JOIN event received, memberAssignment:`,
              JSON.stringify(payload.memberAssignment),
            )

            try {
              console.log(
                `KafkaClient: Executing seek to topic: ${topic}, partition: ${targetPartition}, offset: ${targetOffset}`,
              )
              consumer?.seek({
                topic,
                partition: targetPartition,
                offset: targetOffset!,
              })
              console.log(`KafkaClient: Seek completed successfully`)
            } catch (seekError) {
              console.error(`KafkaClient: Error seeking to offset:`, seekError)
              reject(seekError)
              return
            }

            // Start timeout after group join (60s - aligned with service timeout)
            const defaultTimeout = 60000
            const envTimeout = parseInt(process.env.KAFKA_FETCH_SAMPLE_TIMEOUT_MS ?? '', 10)
            const timeoutDuration = Number.isNaN(envTimeout) ? defaultTimeout : envTimeout

            console.log(`KafkaClient: Starting message fetch timeout: ${timeoutDuration}ms`)
            timeoutId = setTimeout(() => {
              if (!messageReceived) {
                reject(new Error(`Timeout waiting for message from topic: ${topic}`))
              }
            }, timeoutDuration)
          })
        } else {
          // No target offset - start timeout immediately (60s - aligned with service timeout)
          const defaultTimeout = 60000
          const envTimeout = parseInt(process.env.KAFKA_FETCH_SAMPLE_TIMEOUT_MS ?? '', 10)
          const timeoutDuration = Number.isNaN(envTimeout) ? defaultTimeout : envTimeout

          console.log(`KafkaClient: No target offset, starting timeout immediately: ${timeoutDuration}ms`)
          timeoutId = setTimeout(() => {
            if (!messageReceived) {
              reject(new Error(`Timeout waiting for message from topic: ${topic}`))
            }
          }, timeoutDuration)
        }
      })

      const result = await messagePromise
      this.circuitBreaker.recordSuccess()
      return result
    } catch (error) {
      console.error(`KafkaClient: Error in fetchSampleEvent:`, error)
      this.adminClientConnected = false
      this.circuitBreaker.recordFailure()
      throw error
    } finally {
      await cleanup()
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
