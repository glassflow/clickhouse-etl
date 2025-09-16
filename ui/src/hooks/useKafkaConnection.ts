import { KafkaConnectionFormType } from '@/src/scheme'
import { useState } from 'react'

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
          // @ts-expect-error - FIXME: introduce new type for no auth
          requestBody.certificate = values.noAuth.certificate
          break

        case 'SASL/PLAIN':
          requestBody.username = values.saslPlain.username
          requestBody.password = values.saslPlain.password
          requestBody.consumerGroup = values.saslPlain.consumerGroup
          requestBody.certificate = values.saslPlain.certificate
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
          requestBody.useTicketCache = values.saslGssapi.useTicketCache
          requestBody.ticketCachePath = values.saslGssapi.ticketCachePath
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
          requestBody.certificate = scramValues.certificate
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

      // Add SSL-specific properties if using SSL
      // NOTE: This is not used in the current implementation
      // if (values.securityProtocol === 'SASL_SSL' || values.securityProtocol === 'SSL') {
      //   requestBody.truststore = {
      //     location: values.truststore?.location,
      //     password: values.truststore?.password,
      //     type: values.truststore?.type,
      //     algorithm: values.truststore?.algorithm,
      //     certificates: values.truststore?.certificates,
      //   }
      // }

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
        const result = {
          success: false,
          message: data.error || 'Failed to connect to Kafka cluster',
        }
        setConnectionResult(result)
        setKafkaConnection({
          ...values,
          isConnected: false,
        })
        return result
      }
    } catch (error) {
      console.error('Error testing Kafka connection:', error)
      const result = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
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
