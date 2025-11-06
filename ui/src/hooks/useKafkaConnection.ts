import { KafkaConnectionFormType } from '@/src/scheme'
import { useState } from 'react'
import { notify } from '@/src/notifications'
import { kafkaMessages } from '@/src/notifications/messages'

export const useKafkaConnection = () => {
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null)
  const [kafkaConnection, setKafkaConnection] = useState<KafkaConnectionFormType | null>(null)

  const testConnection = async (values: KafkaConnectionFormType): Promise<{ success: boolean; message: string }> => {
    try {
      setIsConnecting(true)
      setConnectionResult(null)

      await new Promise((resolve) => setTimeout(resolve, 5000))

      // Base request body with common properties
      const requestBody: any = {
        servers: values.bootstrapServers,
        securityProtocol: values.securityProtocol,
        authMethod: values.authMethod,
      }

      // Add authentication details based on the auth method
      switch (values.authMethod) {
        case 'NO_AUTH':
          // Certificate is now in truststore.certificates
          if (values.noAuth.truststore?.certificates) {
            requestBody.certificate = values.noAuth.truststore.certificates
          }
          break

        case 'SASL/PLAIN':
          requestBody.username = values.saslPlain.username
          requestBody.password = values.saslPlain.password
          requestBody.consumerGroup = values.saslPlain.consumerGroup
          // Certificate is now in truststore.certificates
          if (values.saslPlain.truststore?.certificates) {
            requestBody.certificate = values.saslPlain.truststore.certificates
          }
          break

        case 'SASL/JAAS':
          requestBody.jaasConfig = values.saslJaas.jaasConfig
          break

        case 'SASL/GSSAPI':
          requestBody.kerberosPrincipal = values.saslGssapi.kerberosPrincipal
          requestBody.kerberosKeytab = values.saslGssapi.kerberosKeytab
          requestBody.kerberosRealm = values.saslGssapi.kerberosRealm
          requestBody.kdc = values.saslGssapi.kdc
          requestBody.serviceName = values.saslGssapi.serviceName
          requestBody.krb5Config = values.saslGssapi.krb5Config
          // requestBody.useTicketCache = values.saslGssapi.useTicketCache
          // requestBody.ticketCachePath = values.saslGssapi.ticketCachePath
          // Certificate is now in truststore.certificates
          if (values.saslGssapi.truststore?.certificates) {
            requestBody.certificate = values.saslGssapi.truststore.certificates
          }
          break

        case 'SASL/OAUTHBEARER':
          requestBody.oauthBearerToken = values.saslOauthbearer.oauthBearerToken
          break

        case 'SASL/SCRAM-256':
        case 'SASL/SCRAM-512':
          const scramValues = values.authMethod === 'SASL/SCRAM-256' ? values.saslScram256 : values.saslScram512
          requestBody.username = scramValues.username
          requestBody.password = scramValues.password
          requestBody.consumerGroup = scramValues.consumerGroup
          // Certificate is now in truststore.certificates
          if (scramValues.truststore?.certificates) {
            requestBody.certificate = scramValues.truststore.certificates
          }
          break

        case 'AWS_MSK_IAM':
          requestBody.awsAccessKey = values.awsIam.awsAccessKey
          requestBody.awsAccessKeySecret = values.awsIam.awsAccessKeySecret
          requestBody.awsRegion = values.awsIam.awsRegion
          // requestBody.awsIAMRoleArn = values.awsIam.awsIAMRoleArn // FIXME: optional - we can remove it or use default value
          break

        case 'Delegation tokens':
          requestBody.delegationToken = values.delegationTokens.delegationToken
          break

        case 'SASL/LDAP':
          requestBody.ldapServerUrl = values.ldap.ldapServerUrl
          requestBody.ldapServerPort = values.ldap.ldapServerPort
          requestBody.ldapBindDn = values.ldap.ldapBindDn
          requestBody.ldapBindPassword = values.ldap.ldapBindPassword
          requestBody.ldapUserSearchFilter = values.ldap.ldapUserSearchFilter
          requestBody.ldapBaseDn = values.ldap.ldapBaseDn
          break

        case 'mTLS':
          requestBody.clientCert = values.mtls.clientCert
          requestBody.clientKey = values.mtls.clientKey
          requestBody.password = values.mtls.password
          break
      }

      // Note: Truststore is now embedded within individual auth methods
      // No need to add it separately here

      const response = await fetch('/ui-api/kafka/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (data.success) {
        const result = {
          success: true,
          message: 'Successfully connected to Kafka cluster!',
        }
        setConnectionResult(result)
        setKafkaConnection({
          ...values,
          isConnected: true,
        })
        return result
      } else {
        const errorMessage = data.error || 'Failed to connect to Kafka cluster'
        const brokers = values.bootstrapServers || 'unknown'

        // Show notification to user
        notify(kafkaMessages.connectionFailed(brokers, errorMessage))

        const result = {
          success: false,
          message: errorMessage,
        }
        setConnectionResult(result)
        setKafkaConnection({
          ...values,
          isConnected: false,
        })
        return result
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      const brokers = values.bootstrapServers || 'unknown'

      // Show notification to user
      notify(kafkaMessages.connectionFailed(brokers, errorMessage))

      const result = {
        success: false,
        message: errorMessage,
      }
      setConnectionResult(result)
      setKafkaConnection({
        ...values,
        isConnected: false,
      })
      return result
    } finally {
      setIsConnecting(false)
    }
  }

  return { testConnection, isConnecting, connectionResult, kafkaConnection }
}
