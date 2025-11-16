import { NextResponse } from 'next/server'
import { KafkaConfig } from '@/src/lib/kafka-client'

const getKafkaBootstrapServers = (originalServers: string) => {
  if (process.env.NEXT_PUBLIC_IN_DOCKER === 'true') {
    // For UI running in Docker - replace localhost/127.0.0.1 with host.docker.internal
    return originalServers.replace(/localhost|127\.0\.0\.1/g, 'host.docker.internal')
  } else {
    // For UI running locally - keep original servers
    return originalServers
  }
}

export function getKafkaConfig(requestBody: any) {
  const { servers, securityProtocol, authMethod, certificate, skipTlsVerification } = requestBody

  const bootstrapServers = getKafkaBootstrapServers(servers)

  // Validate required base fields
  if (
    (authMethod === 'NO_AUTH' && (!servers || !securityProtocol)) ||
    (authMethod !== 'NO_AUTH' && (!servers || !securityProtocol || !authMethod))
  ) {
    return { success: false, error: 'Missing required Kafka connection parameters' }
  }

  if (
    securityProtocol !== 'SASL_SSL' &&
    securityProtocol !== 'SASL_PLAINTEXT' &&
    securityProtocol !== 'SSL' &&
    securityProtocol !== 'PLAINTEXT'
  ) {
    return { success: false, error: 'Unsupported security protocol' }
  }

  const kafkaConfig: KafkaConfig | { success: false; error: string } = {
    brokers: bootstrapServers.split(','),
    securityProtocol,
    authMethod: authMethod === 'NO_AUTH' ? undefined : authMethod, // NOTE: Default to undefined if NO_AUTH
    clientId: 'kafka-local-test',
    skipTlsVerification: skipTlsVerification ?? false,
  }

  // Add certificate if using SSL
  if ((securityProtocol === 'SASL_SSL' || securityProtocol === 'SSL') && certificate) {
    kafkaConfig.certificate = certificate
  }

  // Add auth-specific configuration based on auth method
  switch (authMethod) {
    case 'NO_AUTH':
      break

    case 'SASL/PLAIN':
      const { username, password, consumerGroup } = requestBody
      if (!username || !password) {
        return { success: false, error: 'Missing required SASL/PLAIN parameters' }
      }
      kafkaConfig.username = username
      kafkaConfig.password = password
      // kafkaConfig.groupId = consumerGroup
      break

    case 'SASL/JAAS':
      const { jaasConfig } = requestBody
      if (!jaasConfig) {
        return { success: false, error: 'Missing required JAAS configuration' }
      }
      kafkaConfig.jaasConfig = jaasConfig
      break

    case 'SASL/GSSAPI':
      const {
        kerberosPrincipal,
        kerberosKeytab,
        kerberosRealm,
        kdc,
        serviceName,
        krb5Config,
        useTicketCache,
        ticketCachePath,
      } = requestBody
      if (!kerberosPrincipal || !kerberosKeytab || !serviceName) {
        return { success: false, error: 'Missing required Kerberos parameters' }
      }
      kafkaConfig.kerberosPrincipal = kerberosPrincipal
      kafkaConfig.kerberosKeytab = kerberosKeytab
      if (kerberosRealm) kafkaConfig.kerberosRealm = kerberosRealm
      if (kdc) kafkaConfig.kdc = kdc
      if (serviceName) kafkaConfig.serviceName = serviceName
      if (krb5Config) kafkaConfig.krb5Config = krb5Config
      if (useTicketCache) kafkaConfig.useTicketCache = useTicketCache
      if (ticketCachePath) kafkaConfig.ticketCachePath = ticketCachePath
      break

    case 'SASL/OAUTHBEARER':
      const { oauthBearerToken } = requestBody
      if (!oauthBearerToken) {
        return { success: false, error: 'Missing required OAuth Bearer token' }
      }
      kafkaConfig.oauthBearerToken = oauthBearerToken
      break

    case 'SASL/SCRAM-256':
    case 'SASL/SCRAM-512':
      const { username: scramUsername, password: scramPassword, consumerGroup: scramGroup } = requestBody
      if (!scramUsername || !scramPassword) {
        return { success: false, error: 'Missing required SCRAM parameters' }
      }
      kafkaConfig.username = scramUsername
      kafkaConfig.password = scramPassword
      // kafkaConfig.groupId = scramGroup
      break

    case 'AWS_MSK_IAM':
      const { awsRegion, awsAccessKey, awsAccessKeySecret, awsIAMRoleArn } = requestBody
      if (!awsRegion || !awsAccessKey || !awsAccessKeySecret) {
        return { success: false, error: 'Missing required AWS_MSK_IAM parameters' }
      }
      kafkaConfig.awsRegion = awsRegion
      kafkaConfig.awsAccessKey = awsAccessKey
      kafkaConfig.awsAccessKeySecret = awsAccessKeySecret
      if (awsIAMRoleArn) kafkaConfig.awsIAMRoleArn = awsIAMRoleArn
      break

    case 'Delegation tokens':
      const { delegationToken } = requestBody
      if (!delegationToken) {
        return { success: false, error: 'Missing required delegation token' }
      }
      kafkaConfig.delegationToken = delegationToken
      break

    case 'SASL/LDAP':
      const { ldapServerUrl, ldapServerPort, ldapBindDn, ldapBindPassword, ldapUserSearchFilter, ldapBaseDn } =
        requestBody

      if (!ldapServerUrl || !ldapBindDn || !ldapBindPassword) {
        return { success: false, error: 'Missing required LDAP parameters' }
      }
      kafkaConfig.ldapServerUrl = ldapServerUrl
      if (ldapServerPort) kafkaConfig.ldapServerPort = ldapServerPort
      kafkaConfig.ldapBindDn = ldapBindDn
      kafkaConfig.ldapBindPassword = ldapBindPassword
      if (ldapUserSearchFilter) kafkaConfig.ldapUserSearchFilter = ldapUserSearchFilter
      if (ldapBaseDn) kafkaConfig.ldapBaseDn = ldapBaseDn
      break

    case 'mTLS':
      const { clientCert, clientKey, password: certPassword } = requestBody
      if (!clientCert || !clientKey) {
        return { success: false, error: 'Missing required mTLS parameters' }
      }
      kafkaConfig.clientCert = clientCert
      kafkaConfig.clientKey = clientKey
      if (certPassword) kafkaConfig.password = certPassword
      break

    default:
      return {
        success: false,
        error: `Unsupported authentication method: ${authMethod}`,
      }
  }

  return kafkaConfig
}
