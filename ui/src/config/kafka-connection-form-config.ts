import { AUTH_OPTIONS, SECURITY_PROTOCOL_OPTIONS } from './constants'

export const KafkaBaseFormConfig = {
  base: {
    fields: {
      authMethod: {
        name: 'authMethod',
        label: 'Authentication Method',
        placeholder: 'Select authentication method',
        required: 'Authentication Method is required',
        type: 'select',
        options: Object.values(AUTH_OPTIONS)
          .filter((option) => option.active)
          .map((option) => ({
            label: option.label,
            value: option.name,
          })),
      },
      securityProtocol: {
        name: 'securityProtocol',
        label: 'Security Protocol',
        placeholder: 'Select security protocol',
        required: 'Security Protocol is required',
        type: 'select',
        options: Object.values(SECURITY_PROTOCOL_OPTIONS).map((option) => ({
          label: option,
          value: option,
        })),
      },
      bootstrapServers: {
        name: 'bootstrapServers',
        label: 'Bootstrap Servers',
        placeholder: 'Enter bootstrap servers',
        required: 'Bootstrap Servers are required',
        type: 'text',
      },
    },
  },
}

export const KafkaFormConfig = {
  // org.apache.common.security.plain.PlainLoginModule
  // required username="<client>"
  // password="<client-secret>";
  [AUTH_OPTIONS['SASL/PLAIN'].name]: {
    securityProtocol: SECURITY_PROTOCOL_OPTIONS.SASL_PLAINTEXT,
    authMethod: AUTH_OPTIONS['SASL/PLAIN'],
    fields: {
      username: {
        name: 'saslPlain.username',
        label: 'Username',
        placeholder: 'Enter username',
        required: 'Username is required',
        type: 'text',
      },
      password: {
        name: 'saslPlain.password',
        label: 'Password',
        placeholder: 'Enter password',
        required: 'Password is required',
        type: 'password',
      },
      // Truststore fields are rendered conditionally based on securityProtocol
      // See form-variants.tsx for conditional rendering logic
    },
  },
  [AUTH_OPTIONS['SASL/JAAS'].name]: {
    securityProtocol: SECURITY_PROTOCOL_OPTIONS.SASL_SSL,
    authMethod: AUTH_OPTIONS['SASL/JAAS'],
    fields: {
      jaasConfig: {
        name: 'saslJaas.jaasConfig',
        label: 'JAAS Config',
        placeholder: 'Enter JAAS Config',
        required: 'JAAS Config is required',
        type: 'textarea',
      },
    },
  },
  [AUTH_OPTIONS['SASL/GSSAPI'].name]: {
    securityProtocol: SECURITY_PROTOCOL_OPTIONS.SASL_SSL,
    authMethod: AUTH_OPTIONS['SASL/GSSAPI'],
    fields: {
      kerberosPrincipal: {
        name: 'saslGssapi.kerberosPrincipal',
        label: 'Kerberos Principal',
        placeholder: 'Enter kerberos principal',
        required: 'Kerberos Principal is required',
        type: 'text',
      },
      kerberosKeytab: {
        name: 'saslGssapi.kerberosKeytab',
        label: 'Kerberos Keytab',
        placeholder: 'Enter kerberos keytab',
        required: 'Kerberos Keytab is required',
        type: 'textarea',
      },
      serviceName: {
        name: 'saslGssapi.serviceName',
        label: 'Kerberos Service Name',
        placeholder: 'Enter kerberos service name',
        optional: 'Kerberos Service Name is optional',
        type: 'text',
        defaultValue: 'kafka',
      },
      kerberosRealm: {
        name: 'saslGssapi.kerberosRealm',
        label: 'Kerberos Realm',
        placeholder: 'Enter kerberos realm',
        optional: 'Kerberos Realm is optional',
        type: 'text',
      },
      kdc: {
        name: 'saslGssapi.kdc',
        label: 'Kerberos KDC',
        placeholder: 'Enter kerberos kdc',
        optional: 'Kerberos KDC is optional',
        type: 'text',
      },
      krb5Config: {
        name: 'saslGssapi.krb5Config',
        label: 'Kerberos Configuration (krb5.conf)',
        placeholder: 'Enter kerberos configuration (krb5.conf)',
        optional: 'Kerberos Configuration (krb5.conf) is optional',
        type: 'textarea',
      },
      // useTicketCache: {
      //   name: 'saslGssapi.useTicketCache',
      //   label: 'Use Ticket Cache',
      //   type: 'boolean',
      //   defaultValue: false,
      // },
      // ticketCachePath: {
      //   name: 'saslGssapi.ticketCachePath',
      //   label: 'Ticket Cache Path',
      //   placeholder: 'Enter ticket cache path',
      //   optional: 'Ticket Cache Path is optional',
      //   type: 'text',
      // },
    },
  },
  // org.apache.common.security.oauthbearer.OAuthBearerLoginModule
  // required
  //  clientId="<client-id>"
  //  clientSecret="<client-secret>"
  //  scope="<scope>";
  [AUTH_OPTIONS['SASL/OAUTHBEARER'].name]: {
    securityProtocol: SECURITY_PROTOCOL_OPTIONS.SASL_SSL,
    authMethod: AUTH_OPTIONS['SASL/OAUTHBEARER'],
    fields: {
      oauthBearerToken: {
        name: 'saslOauthbearer.oauthBearerToken',
        label: 'OAuth Bearer Token',
        placeholder: 'Enter oauth bearer token',
        required: 'OAuth Bearer Token is required',
        type: 'textarea',
      },
    },
  },
  [AUTH_OPTIONS['SASL/SCRAM-256'].name]: {
    securityProtocol: SECURITY_PROTOCOL_OPTIONS.SASL_SSL,
    authMethod: AUTH_OPTIONS['SASL/SCRAM-256'],
    fields: {
      username: {
        name: 'saslScram256.username',
        label: 'Username',
        placeholder: 'Enter username',
        required: 'Username is required',
        type: 'text',
      },
      password: {
        name: 'saslScram256.password',
        label: 'Password',
        placeholder: 'Enter password',
        required: 'Password is required',
        type: 'password',
      },
      // Truststore fields are rendered conditionally based on securityProtocol
    },
  },
  [AUTH_OPTIONS['SASL/SCRAM-512'].name]: {
    securityProtocol: SECURITY_PROTOCOL_OPTIONS.SASL_SSL,
    authMethod: AUTH_OPTIONS['SASL/SCRAM-512'],
    fields: {
      username: {
        name: 'saslScram512.username',
        label: 'Username',
        placeholder: 'Enter username',
        required: 'Username is required',
        type: 'text',
      },
      password: {
        name: 'saslScram512.password',
        label: 'Password',
        placeholder: 'Enter password',
        required: 'Password is required',
        type: 'password',
      },
      // Truststore fields are rendered conditionally based on securityProtocol
    },
  },
  [AUTH_OPTIONS['Delegation tokens'].name]: {
    securityProtocol: SECURITY_PROTOCOL_OPTIONS.SASL_SSL,
    authMethod: AUTH_OPTIONS['Delegation tokens'],
    fields: {
      delegationToken: {
        name: 'delegationToken.delegationToken',
        label: 'Delegation Token',
        placeholder: 'Enter delegation token',
        required: 'Delegation Token is required',
        type: 'textarea',
      },
    },
  },
  [AUTH_OPTIONS['SASL/LDAP'].name]: {
    securityProtocol: SECURITY_PROTOCOL_OPTIONS.SASL_SSL,
    authMethod: AUTH_OPTIONS['SASL/LDAP'],
    fields: {
      ldapServerUrl: {
        name: 'ldap.ldapServerUrl',
        label: 'LDAP Server URL',
        placeholder: 'Enter LDAP server URL',
        required: 'LDAP Server URL is required',
        type: 'text',
      },
      ldapServerPort: {
        name: 'ldap.ldapServerPort',
        label: 'LDAP Server Port',
        placeholder: 'Enter LDAP server port',
        required: 'LDAP Server Port is required',
        type: 'number',
      },
      ldapBaseDn: {
        name: 'ldap.ldapBaseDn',
        label: 'LDAP Base DN',
        placeholder: 'Enter LDAP base DN',
        required: 'LDAP Base DN is required',
        type: 'text',
      },
      ldapBindDn: {
        name: 'ldap.ldapBindDn',
        label: 'LDAP Bind DN',
        placeholder: 'Enter LDAP bind DN',
        required: 'LDAP Bind DN is required',
        type: 'text',
      },
      ldapBindPassword: {
        name: 'ldap.ldapBindPassword',
        label: 'LDAP Bind Password',
        placeholder: 'Enter LDAP bind password',
        required: 'LDAP Bind Password is required',
        type: 'password',
      },
      userSearchFilter: {
        name: 'ldap.ldapUserSearchFilter',
        label: 'LDAP User Search Filter',
        placeholder: 'Enter LDAP user search filter',
        required: 'LDAP User Search Filter is required',
        type: 'text',
      },
    },
  },
  [AUTH_OPTIONS['AWS_MSK_IAM'].name]: {
    securityProtocol: SECURITY_PROTOCOL_OPTIONS.SASL_SSL,
    authMethod: AUTH_OPTIONS['AWS_MSK_IAM'],
    fields: {
      awsAccessKey: {
        name: 'awsIam.awsAccessKey',
        label: 'AWS Access Key ID',
        placeholder: 'Enter AWS access key ID',
        required: 'AWS Access Key ID is required',
        type: 'textarea',
      },
      awsAccessKeySecret: {
        name: 'awsIam.awsAccessKeySecret',
        label: 'AWS Access Key Secret',
        placeholder: 'Enter AWS access key secret',
        required: 'AWS Access Key Secret is required',
        type: 'textarea',
      },
      awsRegion: {
        name: 'awsIam.awsRegion',
        label: 'AWS Region',
        placeholder: 'Enter AWS region',
        required: 'AWS Region is required',
        type: 'text',
      },
      awsAuthorizationIdentity: {
        name: 'awsIam.awsAuthorizationIdentity',
        label: 'AWS Authorization Identity',
        placeholder: 'Enter AWS authorization identity',
        required: 'AWS Authorization Identity is required',
        type: 'text',
      },
      awsIAMRoleArn: {
        name: 'awsIam.awsIAMRoleArn',
        label: 'AWS Role ARN',
        placeholder: 'Enter AWS Role ARN',
        optional: 'AWS Role ARN is optional',
        type: 'text',
      },
      awsSessionToken: {
        name: 'awsIam.awsSessionToken',
        label: 'AWS Session Token',
        placeholder: 'Enter AWS session token',
        optional: 'AWS Session Token is optional',
        type: 'text',
      },
    },
  },
  [AUTH_OPTIONS['mTLS'].name]: {
    securityProtocol: SECURITY_PROTOCOL_OPTIONS.SASL_SSL,
    authMethod: AUTH_OPTIONS['mTLS'],
    fields: {
      clientCert: {
        name: 'mtls.clientCert',
        label: 'Client Certificate',
        placeholder: 'Enter client certificate',
        required: 'Client Certificate is required',
        type: 'textarea',
      },
      clientKey: {
        name: 'mtls.clientKey',
        label: 'Client Key',
        placeholder: 'Enter client key',
        required: 'Client Key is required',
        type: 'textarea',
      },
      password: {
        name: 'mtls.password',
        label: 'Password',
        placeholder: 'Enter password',
        required: 'Password is required',
        type: 'password',
      },
    },
  },
  [AUTH_OPTIONS['NO_AUTH'].name]: {
    securityProtocol: SECURITY_PROTOCOL_OPTIONS.SASL_PLAINTEXT, // Default, but supports SSL too
    authMethod: AUTH_OPTIONS['NO_AUTH'],
    fields: {
      // Truststore fields are rendered conditionally based on securityProtocol
      // See form-variants.tsx for conditional rendering logic
    },
  },
  truststore: {
    fields: {
      location: {
        name: 'truststore.location',
        label: 'Certificate File',
        placeholder: 'Upload or paste certificate content',
        required: false, // Optional - can use file upload or paste
        type: 'file',
      },
      password: {
        name: 'truststore.password',
        label: 'Truststore Password (optional)',
        placeholder: 'Enter password for encrypted truststore',
        required: false,
        type: 'password',
      },
      type: {
        name: 'truststore.type',
        label: 'Truststore Type (optional)',
        placeholder: 'JKS, PKCS12, PEM, etc.',
        required: false,
        type: 'text',
      },
      algorithm: {
        name: 'truststore.algorithm',
        label: 'SSL Algorithm (optional)',
        placeholder: 'Leave empty for self-signed certificates',
        required: false,
        type: 'text',
      },
      certificates: {
        name: 'truststore.certificates',
        label: 'CA Certificate (PEM format)',
        placeholder: 'Paste CA certificate content here or upload a file',
        required: false,
        type: 'textarea',
      },
      skipCertificateVerification: {
        name: 'truststore.skipCertificateVerification',
        label: 'Skip Certificate Verification',
        type: 'boolean',
        defaultValue: false,
        placeholder: 'Skip Certificate Verification',
      },
    },
  },
}

export const KafkaFormDefaultValues = {
  authMethod: AUTH_OPTIONS['SASL/PLAIN'].name,
  securityProtocol: SECURITY_PROTOCOL_OPTIONS.SASL_PLAINTEXT,
  bootstrapServers:
    process.env.NEXT_PUBLIC_IS_DOCKER === 'true'
      ? 'host.docker.internal:9092,host.docker.internal:9093,host.docker.internal:9094'
      : 'localhost:9092,localhost:9093,localhost:9094',
  isConnected: false,
  noAuth: {
    truststore: {
      location: '',
      password: '',
      type: '',
      algorithm: '',
      certificates: '',
      certificatesFileName: '',
      skipCertificateVerification: false,
    },
  },
  saslPlain: {
    username: 'admin',
    password: 'admin-secret',
    truststore: {
      location: '',
      password: '',
      type: '',
      algorithm: '',
      certificates: '',
      certificatesFileName: '',
      skipCertificateVerification: false,
    },
    consumerGroup: '',
  },
  saslJaas: {
    jaasConfig: '',
  },
  saslGssapi: {
    kerberosPrincipal: '',
    kerberosKeytab: '',
    kerberosKeytabFileName: '',
    kerberosRealm: '',
    kdc: '',
    serviceName: 'kafka',
    krb5Config: '',
    krb5ConfigFileName: '',
    useTicketCache: false,
    ticketCachePath: '',
    truststore: {
      location: '',
      password: '',
      type: '',
      algorithm: '',
      certificates: '',
      certificatesFileName: '',
      skipCertificateVerification: false,
    },
  },
  saslOauthbearer: {
    oauthBearerToken: '',
  },
  saslScram256: {
    username: '',
    password: '',
    truststore: {
      location: '',
      password: '',
      type: '',
      algorithm: '',
      certificates: '',
      certificatesFileName: '',
      skipCertificateVerification: false,
    },
    consumerGroup: '',
  },
  saslScram512: {
    username: '',
    password: '',
    truststore: {
      location: '',
      password: '',
      type: '',
      algorithm: '',
      certificates: '',
      certificatesFileName: '',
      skipCertificateVerification: false,
    },
    consumerGroup: '',
  },
  delegationToken: {
    delegationToken: '',
  },
  ldap: {
    ldapServerUrl: '',
    ldapServerPort: '',
    ldapBaseDn: '',
    ldapBindDn: '',
    ldapBindPassword: '',
    ldapUserSearchFilter: '',
  },
  awsIam: {
    awsAccessKey: '',
    awsAccessKeySecret: '',
    awsRegion: '',
    awsIAMRoleArn: '',
  },
  mtls: {
    clientCert: '',
    clientKey: '',
    password: '',
  },
}

export const KafkaConnectionFormConfig = {
  basicConnectionForm: {
    fields: {
      bootstrapServers: {
        name: 'basicConnection.bootstrapServers',
        label: 'Bootstrap Servers',
        placeholder: 'Enter bootstrap servers (e.g., localhost:9092)',
        required: 'Bootstrap servers are required',
        type: 'text',
      },
      securityProtocol: {
        name: 'basicConnection.securityProtocol',
        label: 'Security Protocol',
        placeholder: 'Select security protocol',
        required: 'Security protocol is required',
        type: 'select',
        options: [
          { value: 'PLAINTEXT', label: 'PLAINTEXT' },
          { value: 'SSL', label: 'SSL' },
          { value: 'SASL_PLAINTEXT', label: 'SASL_PLAINTEXT' },
          { value: 'SASL_SSL', label: 'SASL_SSL' },
        ],
      },
      sslEnabled: {
        name: 'basicConnection.sslEnabled',
        label: 'SSL Enabled',
        type: 'boolean',
      },
    },
  },
  authenticationForm: {
    fields: {
      authMethod: {
        name: 'authentication.authMethod',
        label: 'Authentication Method',
        placeholder: 'Select authentication method',
        required: 'Authentication method is required',
        type: 'select',
        options: [
          { value: 'SASL/PLAIN', label: 'SASL/PLAIN' },
          { value: 'SASL/SCRAM-256', label: 'SASL/SCRAM-256' },
          { value: 'SASL/SCRAM-512', label: 'SASL/SCRAM-512' },
          { value: 'SASL/GSSAPI', label: 'SASL/GSSAPI' },
          { value: 'SASL/OAUTHBEARER', label: 'SASL/OAUTHBEARER' },
          { value: 'AWS_MSK_IAM', label: 'AWS MSK IAM' },
          { value: 'mTLS', label: 'mTLS' },
          { value: 'NO_AUTH', label: 'NO_AUTH' },
        ],
      },
      // SCRAM-256 and SCRAM-512 fields
      scramUsername: {
        name: 'authentication.scram.username',
        label: 'Username',
        placeholder: 'Enter username',
        required: 'Username is required',
        type: 'text',
        showWhen: {
          authMethod: ['SASL/SCRAM-256', 'SASL/SCRAM-512'],
        },
      },
      scramPassword: {
        name: 'authentication.scram.password',
        label: 'Password',
        placeholder: 'Enter password',
        required: 'Password is required',
        type: 'password',
        showWhen: {
          authMethod: ['SASL/SCRAM-256', 'SASL/SCRAM-512'],
        },
      },
      scramCertificate: {
        name: 'authentication.scram.certificate',
        label: 'Certificate',
        placeholder: 'Enter certificate content',
        type: 'textarea',
        showWhen: {
          authMethod: ['SASL/SCRAM-256', 'SASL/SCRAM-512'],
          securityProtocol: 'SASL_SSL',
        },
      },
      // mTLS fields
      mtlsEnabled: {
        name: 'authentication.mtls.enabled',
        label: 'mTLS Enabled',
        type: 'boolean',
        showWhen: {
          authMethod: 'mTLS',
        },
      },
      mtlsClientCert: {
        name: 'authentication.mtls.clientCert',
        label: 'Client Certificate',
        placeholder: 'Enter client certificate',
        type: 'textarea',
        showWhen: {
          authMethod: 'mTLS',
          mtlsEnabled: true,
        },
      },
      mtlsClientKey: {
        name: 'authentication.mtls.clientKey',
        label: 'Client Key',
        placeholder: 'Enter client key',
        type: 'textarea',
        showWhen: {
          authMethod: 'mTLS',
          mtlsEnabled: true,
        },
      },
    },
  },
}
