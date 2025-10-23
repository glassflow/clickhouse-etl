/**
 * Kafka Client Factory
 *
 * Factory pattern to create the appropriate Kafka client based on authentication method
 * - Uses KafkaJS for most authentication methods (PLAIN, SCRAM, AWS IAM, etc.)
 * - Uses node-rdkafka for Kerberos (SASL/GSSAPI) which requires native library support
 */

import { IKafkaClient, KafkaConfig, KafkaClientType } from './kafka-client-interface'
import { RdKafkaClient } from './kafka-rdkafka-client'
import { KafkaGatewayClient } from './kafka-gateway-client'

// Lazy load KafkaJS client to avoid circular dependencies
let KafkaJSClient: any = null

export class KafkaClientFactory {
  /**
   * Create a Kafka client based on the authentication method
   *
   * @param config - Kafka configuration
   * @returns IKafkaClient instance
   */
  static async createClient(config: KafkaConfig): Promise<IKafkaClient> {
    const clientType = this.determineClientType(config)

    console.log(`[KafkaClientFactory] Creating ${clientType} client for auth method: ${config.authMethod || 'default'}`)

    switch (clientType) {
      case KafkaClientType.GATEWAY:
        // Use Go-based gateway service for Kerberos
        return new KafkaGatewayClient(config)

      case KafkaClientType.RDKAFKA:
        // Fallback to RdKafka if gateway is not available (not recommended for Kerberos)
        return new RdKafkaClient(config)

      case KafkaClientType.KAFKAJS:
      default:
        return await this.createKafkaJSClient(config)
    }
  }

  /**
   * Determine which client type to use based on authentication method
   */
  private static determineClientType(config: KafkaConfig): KafkaClientType {
    // Use Gateway for Kerberos authentication (stable, production-ready)
    if (config.authMethod === 'SASL/GSSAPI') {
      return KafkaClientType.GATEWAY
    }

    // Use KafkaJS for all other authentication methods
    return KafkaClientType.KAFKAJS
  }

  /**
   * Create KafkaJS client (lazy loaded to avoid import issues)
   */
  private static async createKafkaJSClient(config: KafkaConfig): Promise<IKafkaClient> {
    if (!KafkaJSClient) {
      // Lazy load to avoid circular dependency
      const kafkaClientModule = await import('./kafka-client')
      // Access the KafkaClient class from the module
      KafkaJSClient = (kafkaClientModule as any).KafkaClient || kafkaClientModule
    }

    return new KafkaJSClient(config)
  }

  /**
   * Check if RdKafka is available on the system
   */
  static isRdKafkaAvailable(): boolean {
    // Only check on server-side
    if (typeof window === 'undefined') {
      try {
        // Try to dynamically import the module
        // If it succeeds, the module is available
        eval("require.resolve('node-rdkafka')")
        return true
      } catch {
        // Module not found
        return false
      }
    }
    // Client-side, node-rdkafka is not available
    return false
  }

  /**
   * Check if a specific auth method is supported
   */
  static isAuthMethodSupported(authMethod: string): boolean {
    // Kerberos requires RdKafka
    if (authMethod === 'SASL/GSSAPI') {
      return this.isRdKafkaAvailable()
    }

    // All other methods are supported by KafkaJS
    return true
  }

  /**
   * Get supported authentication methods
   */
  static getSupportedAuthMethods(): string[] {
    const methods = ['NO_AUTH', 'SASL/PLAIN', 'SASL/SCRAM-256', 'SASL/SCRAM-512', 'AWS_MSK_IAM', 'mTLS', 'SSL']

    // Add Kerberos if RdKafka is available
    if (this.isRdKafkaAvailable()) {
      methods.push('SASL/GSSAPI')
    }

    return methods
  }
}

/**
 * Convenience function to create a Kafka client
 *
 * @param config - Kafka configuration
 * @returns IKafkaClient instance
 *
 * @example
 * ```typescript
 * const client = await createKafkaClient({
 *   brokers: ['localhost:9092'],
 *   authMethod: 'SASL/GSSAPI',
 *   kerberosPrincipal: 'kafka/kafka@EXAMPLE.COM',
 *   kerberosKeytab: '/path/to/kafka.keytab',
 * })
 *
 * await client.connect()
 * await client.send('my-topic', [{ value: 'Hello Kafka!' }])
 * await client.disconnect()
 * ```
 */
export async function createKafkaClient(config: KafkaConfig): Promise<IKafkaClient> {
  return await KafkaClientFactory.createClient(config)
}

/**
 * Check if Kerberos authentication is available
 */
export function isKerberosSupported(): boolean {
  return KafkaClientFactory.isRdKafkaAvailable()
}

/**
 * Get all supported authentication methods on this system
 */
export function getSupportedAuthMethods(): string[] {
  return KafkaClientFactory.getSupportedAuthMethods()
}
