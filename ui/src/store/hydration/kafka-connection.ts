import { useStore } from '../index'

// Map backend pipeline config to KafkaConnectionFormType (store shape)
function mapBackendKafkaConfigToStore(connection_params: any): any {
  const skipAuth = Boolean(connection_params.skip_auth)

  // Map backend mechanism to UI auth method names
  const mech = (connection_params.mechanism || '').toString().toUpperCase()
  const authMethod = skipAuth
    ? 'NO_AUTH'
    : mech === 'PLAIN'
      ? 'SASL/PLAIN'
      : mech === 'SCRAM-SHA-256'
        ? 'SASL/SCRAM-256'
        : mech === 'SCRAM-SHA-512'
          ? 'SASL/SCRAM-512'
          : mech === 'OAUTHBEARER'
            ? 'SASL/OAUTHBEARER'
            : mech === 'GSSAPI'
              ? 'SASL/GSSAPI'
              : mech === 'JAAS'
                ? 'SASL/JAAS'
                : mech === 'LDAP'
                  ? 'SASL/LDAP'
                  : mech === 'MTLS'
                    ? 'mTLS'
                    : ''

  return {
    // base values
    authMethod,
    securityProtocol: connection_params.protocol || '',
    bootstrapServers: (connection_params.brokers || []).join(', '),
    skipAuth,

    // sasl connection types
    saslPlain: {
      username: connection_params.username || '',
      password: connection_params.password || '',
      truststore: {
        location: '',
        password: '',
        type: '',
        algorithm: '',
        certificates: connection_params.root_ca ? atob(connection_params.root_ca) : '',
        skipTlsVerification: connection_params.skip_tls_verification ?? false,
      },
      consumerGroup: connection_params.consumer_group || '',
    },
    // sasl scram 256 connection type
    saslScram256: {
      username: connection_params.username || '',
      password: connection_params.password || '',
      truststore: {
        location: '',
        password: '',
        type: '',
        algorithm: '',
        certificates: connection_params.root_ca ? atob(connection_params.root_ca) : '',
        skipTlsVerification: connection_params.skip_tls_verification ?? false,
      },
      consumerGroup: connection_params.consumer_group || '',
    },
    // sasl scram 512 connection type
    saslScram512: {
      username: connection_params.username || '',
      password: connection_params.password || '',
      truststore: {
        location: '',
        password: '',
        type: '',
        algorithm: '',
        certificates: connection_params.root_ca ? atob(connection_params.root_ca) : '',
        skipTlsVerification: connection_params.skip_tls_verification ?? false,
      },
    },
    // sasl jaas config connection type
    saslJaas: {
      jaasConfig: connection_params.jaas_config || '',
    },
    // sasl gssapi connection type
    saslGssapi: {
      kerberosPrincipal: connection_params.kerberos_principal || '',
      kerberosKeytab: connection_params.kerberos_keytab || '',
      serviceName: connection_params.service_name || '',
      kerberosRealm: connection_params.kerberos_realm || '',
      kdc: connection_params.kdc || '',
      krb5Config: connection_params.krb5_config || '',
      useTicketCache: connection_params.use_ticket_cache || false,
      ticketCachePath: connection_params.ticket_cache_path || '',
      truststore: {
        location: '',
        password: '',
        type: '',
        algorithm: '',
        certificates: connection_params.root_ca ? atob(connection_params.root_ca) : '',
        skipTlsVerification: connection_params.skip_tls_verification ?? false,
      },
    },
    // sasl oauthbearer connection type
    saslOauthbearer: {
      oauthBearerToken: connection_params.oauth_bearer_token || '',
    },
    // aws iam connection type
    awsIam: {
      awsRegion: connection_params.aws_region || '',
      awsIAMRoleArn: connection_params.aws_iam_role_arn || '',
      awsAccessKey: connection_params.aws_access_key || '',
      awsAccessKeySecret: connection_params.aws_access_key_secret || '',
    },
    // delegation tokens connection type
    delegationTokens: {
      delegationToken: connection_params.delegation_token || '',
    },
    // ldap connection type
    ldap: {
      ldapServerUrl: connection_params.ldap_server_url || '',
      ldapServerPort: connection_params.ldap_server_port || '',
      ldapBindDn: connection_params.ldap_bind_dn || '',
      ldapBindPassword: connection_params.ldap_bind_password || '',
      ldapUserSearchFilter: connection_params.ldap_user_search_filter || '',
      ldapBaseDn: connection_params.ldap_base_dn || '',
    },
    // mtls connection type
    mtls: {
      clientCert: connection_params.client_cert || '',
      clientKey: connection_params.client_key || '',
      password: connection_params.password || '',
    },
    // no auth connection type
    noAuth: {
      truststore: {
        location: '',
        password: '',
        type: '',
        algorithm: '',
        certificates: connection_params.root_ca ? atob(connection_params.root_ca) : '',
        skipTlsVerification: connection_params.skip_tls_verification ?? false,
      },
    },
  }
}

export function hydrateKafkaConnection(pipelineConfig: any) {
  if (pipelineConfig?.source?.connection_params) {
    const kafkaConnection = mapBackendKafkaConfigToStore(pipelineConfig.source.connection_params)
    useStore.getState().kafkaStore.setKafkaConnection(kafkaConnection)
  }
}
