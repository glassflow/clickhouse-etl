import { KafkaStore } from '@/src/store/kafka.store'

export interface KafkaApiRequest {
  servers: string
  securityProtocol: string
  authMethod: string
  [key: string]: any
}

// Use KafkaApiRequest directly for topic fetching

export interface FetchEventRequest extends KafkaApiRequest {
  topic: string
  format?: string
  getNext?: boolean
  currentOffset?: string | null
  position?: 'earliest' | 'latest'
  direction?: 'next' | 'previous'
  currentPosition?: any
  runConsumerFirst?: boolean
}

export interface KafkaApiResponse<T = any> {
  success: boolean
  error?: string
  data?: T
  topics?: string[]
  event?: any
  offset?: string
  position?: any
}

export class KafkaApiClient {
  private buildAuthHeaders(kafka: KafkaStore): Partial<KafkaApiRequest> {
    const headers: Partial<KafkaApiRequest> = {
      servers: kafka.bootstrapServers,
      securityProtocol: kafka.securityProtocol,
      authMethod: kafka.authMethod,
    }

    // Add certificate if using SSL (handles all auth methods that support certificates)
    if (kafka.securityProtocol === 'SASL_SSL' || kafka.securityProtocol === 'SSL') {
      switch (kafka.authMethod) {
        case 'NO_AUTH':
          headers.certificate = kafka.noAuth.certificate
          break
        case 'SASL/PLAIN':
          headers.certificate = kafka.saslPlain.certificate
          break
        case 'SASL/SCRAM-256':
          headers.certificate = kafka.saslScram256.certificate
          break
        case 'SASL/SCRAM-512':
          headers.certificate = kafka.saslScram512.certificate
          break
        // Add other auth methods that support certificates here if needed
      }
    }

    // Add authentication details based on the auth method
    switch (kafka.authMethod) {
      case 'NO_AUTH':
        // Certificate already handled above if SSL is enabled
        break

      case 'SASL/PLAIN':
        headers.username = kafka.saslPlain.username
        headers.password = kafka.saslPlain.password
        headers.consumerGroup = kafka.saslPlain.consumerGroup
        // Certificate already handled above if SSL is enabled
        break

      case 'SASL/JAAS':
        headers.jaasConfig = kafka.saslJaas.jaasConfig
        break

      case 'SASL/GSSAPI':
        headers.kerberosPrincipal = kafka.saslGssapi.kerberosPrincipal
        headers.kerberosKeytab = kafka.saslGssapi.kerberosKeytab
        headers.kerberosRealm = kafka.saslGssapi.kerberosRealm
        headers.kdc = kafka.saslGssapi.kdc
        break

      case 'SASL/OAUTHBEARER':
        headers.oauthBearerToken = kafka.saslOauthbearer.oauthBearerToken
        break

      case 'SASL/SCRAM-256':
      case 'SASL/SCRAM-512':
        const scramValues = kafka.authMethod === 'SASL/SCRAM-256' ? kafka.saslScram256 : kafka.saslScram512
        headers.username = scramValues.username
        headers.password = scramValues.password
        headers.consumerGroup = scramValues.consumerGroup
        // Certificate already handled above if SSL is enabled
        break

      case 'AWS_MSK_IAM':
        headers.awsRegion = kafka.awsIam.awsRegion
        headers.awsIAMRoleArn = kafka.awsIam.awsIAMRoleArn
        headers.awsAccessKey = kafka.awsIam.awsAccessKey
        headers.awsAccessKeySecret = kafka.awsIam.awsAccessKeySecret
        break

      case 'Delegation tokens':
        headers.delegationToken = kafka.delegationTokens.delegationToken
        break

      case 'SASL/LDAP':
        headers.ldapServerUrl = kafka.ldap.ldapServerUrl
        headers.ldapServerPort = kafka.ldap.ldapServerPort
        headers.ldapBindDn = kafka.ldap.ldapBindDn
        headers.ldapBindPassword = kafka.ldap.ldapBindPassword
        headers.ldapUserSearchFilter = kafka.ldap.ldapUserSearchFilter
        headers.ldapBaseDn = kafka.ldap.ldapBaseDn
        break

      case 'mTLS':
        headers.clientCert = kafka.mtls.clientCert
        headers.clientKey = kafka.mtls.clientKey
        headers.password = kafka.mtls.password
        break
    }

    return headers
  }

  async fetchTopics(kafka: KafkaStore): Promise<KafkaApiResponse> {
    if (!kafka.bootstrapServers) {
      return {
        success: false,
        error: 'Kafka connection details are missing',
      }
    }

    try {
      const requestBody = this.buildAuthHeaders(kafka)

      const response = await fetch('/api/kafka/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (data.success) {
        return {
          success: true,
          topics: data.topics,
        }
      } else {
        return {
          success: false,
          error: data.error || 'Failed to fetch topics',
        }
      }
    } catch (error) {
      return {
        success: false,
        error: 'Error connecting to Kafka',
      }
    }
  }

  async fetchEvent(
    kafka: KafkaStore,
    options: {
      topic: string
      format?: string
      getNext?: boolean
      currentOffset?: string | null
      position?: 'earliest' | 'latest'
      direction?: 'next' | 'previous'
      currentPosition?: any
      runConsumerFirst?: boolean
    },
  ): Promise<KafkaApiResponse> {
    if (!kafka.bootstrapServers || !options.topic) {
      return {
        success: false,
        error: 'Missing required parameters: bootstrapServers or topic',
      }
    }

    // Build the request body using the centralized auth headers method
    const authHeaders = this.buildAuthHeaders(kafka)
    const requestBody: FetchEventRequest = {
      servers: authHeaders.servers!,
      securityProtocol: authHeaders.securityProtocol!,
      authMethod: authHeaders.authMethod!,
      ...authHeaders,
      ...options,
    }

    try {
      const response = await fetch('/api/kafka/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        data,
        event: data.event,
        offset: data.offset,
        position: data.position,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }
}

// Singleton instance
export const kafkaApiClient = new KafkaApiClient()
