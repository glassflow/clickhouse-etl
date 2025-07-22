import { KafkaConnectionFormType } from '@/src/scheme'
import { KafkaStore } from '@/src/store/kafka.store'
import { useState } from 'react'

export const useFetchTopics = ({ kafka }: { kafka: any }) => {
  const [topics, setTopics] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTopics = async () => {
    if (!kafka) {
      setError('Kafka connection details are missing')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Base request body with common properties
      const requestBody: any = {
        servers: kafka.bootstrapServers,
        securityProtocol: kafka.securityProtocol,
        authMethod: kafka.authMethod,
      }

      // Add authentication details based on the auth method
      switch (kafka.authMethod) {
        case 'NO_AUTH':
          requestBody.certificate = kafka.noAuth.certificate
          break

        case 'SASL/PLAIN':
          requestBody.username = kafka.saslPlain.username
          requestBody.password = kafka.saslPlain.password
          requestBody.consumerGroup = kafka.saslPlain.consumerGroup
          requestBody.certificate = kafka.saslPlain.certificate
          break

        case 'SASL/JAAS':
          requestBody.jaasConfig = kafka.saslJaas.jaasConfig
          break

        case 'SASL/GSSAPI':
          requestBody.kerberosPrincipal = kafka.saslGssapi.kerberosPrincipal
          requestBody.kerberosKeytab = kafka.saslGssapi.kerberosKeytab
          requestBody.kerberosRealm = kafka.saslGssapi.kerberosRealm
          requestBody.kdc = kafka.saslGssapi.kdc
          break

        case 'SASL/OAUTHBEARER':
          requestBody.oauthBearerToken = kafka.saslOauthbearer.oauthBearerToken
          break

        case 'SASL/SCRAM-256':
        case 'SASL/SCRAM-512':
          const scramValues = kafka.authMethod === 'SASL/SCRAM-256' ? kafka.saslScram256 : kafka.saslScram512
          requestBody.username = scramValues.username
          requestBody.password = scramValues.password
          requestBody.consumerGroup = scramValues.consumerGroup
          requestBody.certificate = scramValues.certificate
          break

        case 'AWS_MSK_IAM':
          requestBody.awsRegion = kafka.awsIam.awsRegion
          requestBody.awsIAMRoleArn = kafka.awsIam.awsIAMRoleArn
          requestBody.awsAccessKey = kafka.awsIam.awsAccessKey
          requestBody.awsAccessKeySecret = kafka.awsIam.awsAccessKeySecret
          break

        case 'Delegation tokens':
          requestBody.delegationToken = kafka.delegationTokens.delegationToken
          break

        case 'SASL/LDAP':
          requestBody.ldapServerUrl = kafka.ldap.ldapServerUrl
          requestBody.ldapServerPort = kafka.ldap.ldapServerPort
          requestBody.ldapBindDn = kafka.ldap.ldapBindDn
          requestBody.ldapBindPassword = kafka.ldap.ldapBindPassword
          requestBody.ldapUserSearchFilter = kafka.ldap.ldapUserSearchFilter
          requestBody.ldapBaseDn = kafka.ldap.ldapBaseDn
          break

        case 'mTLS':
          requestBody.clientCert = kafka.mtls.clientCert
          requestBody.clientKey = kafka.mtls.clientKey
          requestBody.password = kafka.mtls.password
          break
      }

      // Add SSL-specific properties if using SSL
      // NOTE: This is not used in the current implementation
      // if (kafka.securityProtocol === 'SASL_SSL' || kafka.securityProtocol === 'SSL') {
      //   requestBody.truststore = kafka.truststore
      // }

      const response = await fetch('/api/kafka/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (data.success) {
        setTopics(data.topics)
      } else {
        console.error('Error fetching topics:', data.error)
        setError(data.error || 'Failed to fetch topics')
      }
    } catch (error) {
      setError('Error connecting to Kafka')
      console.error('Error fetching topics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return { topics, isLoading, error, fetchTopics }
}
