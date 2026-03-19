import type { KafkaConnectionFormType } from '@/src/scheme'

/**
 * Request body shape for Kafka API endpoints (test connection, fetch topics).
 * Used by POST /ui-api/kafka/ and POST /ui-api/kafka/topics.
 */
export interface KafkaConnectionRequestBody {
  servers: string
  securityProtocol: string
  authMethod: string
  skipTlsVerification?: boolean
  [key: string]: unknown
}

/**
 * Builds the request body for Kafka API calls from connection form values.
 * Single source of truth for mapping KafkaConnectionFormType to the payload
 * expected by /ui-api/kafka/ and /ui-api/kafka/topics.
 */
export function connectionFormToRequestBody(values: KafkaConnectionFormType): KafkaConnectionRequestBody {
  let skipTlsVerification = false
  switch (values.authMethod) {
    case 'SASL/PLAIN':
      skipTlsVerification = values.saslPlain?.truststore?.skipTlsVerification ?? false
      break
    case 'SASL/SCRAM-256':
      skipTlsVerification = values.saslScram256?.truststore?.skipTlsVerification ?? false
      break
    case 'SASL/SCRAM-512':
      skipTlsVerification = values.saslScram512?.truststore?.skipTlsVerification ?? false
      break
    case 'SASL/GSSAPI':
      skipTlsVerification = values.saslGssapi?.truststore?.skipTlsVerification ?? false
      break
    case 'NO_AUTH':
      skipTlsVerification = values.noAuth?.truststore?.skipTlsVerification ?? false
      break
  }

  const requestBody: KafkaConnectionRequestBody = {
    servers: values.bootstrapServers,
    securityProtocol: values.securityProtocol,
    authMethod: values.authMethod,
    skipTlsVerification: skipTlsVerification || undefined,
  }

  switch (values.authMethod) {
    case 'NO_AUTH':
      if (values.noAuth?.truststore?.certificates) {
        requestBody.certificate = values.noAuth.truststore.certificates
      }
      break

    case 'SASL/PLAIN':
      requestBody.username = values.saslPlain?.username
      requestBody.password = values.saslPlain?.password
      requestBody.consumerGroup = values.saslPlain?.consumerGroup
      if (values.saslPlain?.truststore?.certificates) {
        requestBody.certificate = values.saslPlain.truststore.certificates
      }
      break

    case 'SASL/JAAS':
      requestBody.jaasConfig = values.saslJaas?.jaasConfig
      break

    case 'SASL/GSSAPI':
      requestBody.kerberosPrincipal = values.saslGssapi?.kerberosPrincipal
      requestBody.kerberosKeytab = values.saslGssapi?.kerberosKeytab
      requestBody.kerberosRealm = values.saslGssapi?.kerberosRealm
      requestBody.kdc = values.saslGssapi?.kdc
      requestBody.serviceName = values.saslGssapi?.serviceName
      requestBody.krb5Config = values.saslGssapi?.krb5Config
      if (values.saslGssapi?.truststore?.certificates) {
        requestBody.certificate = values.saslGssapi.truststore.certificates
      }
      break

    case 'SASL/OAUTHBEARER':
      requestBody.oauthBearerToken = values.saslOauthbearer?.oauthBearerToken
      break

    case 'SASL/SCRAM-256':
    case 'SASL/SCRAM-512': {
      const scramValues = values.authMethod === 'SASL/SCRAM-256' ? values.saslScram256 : values.saslScram512
      requestBody.username = scramValues?.username
      requestBody.password = scramValues?.password
      requestBody.consumerGroup = scramValues?.consumerGroup
      if (scramValues?.truststore?.certificates) {
        requestBody.certificate = scramValues.truststore.certificates
      }
      break
    }

    case 'AWS_MSK_IAM':
      requestBody.awsAccessKey = values.awsIam?.awsAccessKey
      requestBody.awsAccessKeySecret = values.awsIam?.awsAccessKeySecret
      requestBody.awsRegion = values.awsIam?.awsRegion
      break

    case 'Delegation tokens':
      requestBody.delegationToken = values.delegationTokens?.delegationToken
      break

    case 'SASL/LDAP':
      requestBody.ldapServerUrl = values.ldap?.ldapServerUrl
      requestBody.ldapServerPort = values.ldap?.ldapServerPort
      requestBody.ldapBindDn = values.ldap?.ldapBindDn
      requestBody.ldapBindPassword = values.ldap?.ldapBindPassword
      requestBody.ldapUserSearchFilter = values.ldap?.ldapUserSearchFilter
      requestBody.ldapBaseDn = values.ldap?.ldapBaseDn
      break

    case 'mTLS':
      requestBody.clientCert = values.mtls?.clientCert
      requestBody.clientKey = values.mtls?.clientKey
      requestBody.password = values.mtls?.password
      break
  }

  return requestBody
}
