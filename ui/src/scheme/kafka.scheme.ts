import { z } from 'zod'

const KafkaMetaFormSchema = z.object({
  authMethod: z.string(),
  securityProtocol: z.string(),
})

const KafkaBaseFormSchema = z.object({
  bootstrapServers: z.string().min(1, 'Bootstrap servers are required'),
})

// Define Truststore schema first so it can be reused
// When truststore is provided, certificates must be present
const TruststoreFormSchema = z.object({
  location: z.string().optional(), // Optional - for UI file path reference
  password: z.string().optional(), // Optional - only needed for encrypted truststores
  type: z.string().optional(), // Optional - JKS, PKCS12, etc.
  algorithm: z.string().optional(), // Optional - for self-signed certificates
  certificates: z.string().optional(), // Optional - but will be validated conditionally
  certificatesFileName: z.string().optional(), // Store the filename for UI display
  skipTlsVerification: z.boolean().optional(), // Optional - skip TLS verification for SSL/TLS connections
})

const SaslPlainFormSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  truststore: TruststoreFormSchema.optional(),
  consumerGroup: z.string().optional(),
})

const NoAuthFormSchema = z.object({
  truststore: TruststoreFormSchema.optional(),
})

const SaslJaasFormSchema = z.object({
  jaasConfig: z.string().min(1, 'JAAS config is required'),
})

const SaslGssapiFormSchema = z.object({
  kerberosPrincipal: z.string().min(1, 'Kerberos principal is required'),
  kerberosKeytab: z.string().min(1, 'Kerberos keytab is required'),
  kerberosKeytabFileName: z.string().optional(), // Store the filename for UI display
  kerberosRealm: z.string().min(1, 'Kerberos realm is required'),
  kdc: z.string().min(1, 'Kerberos KDC is required'),
  serviceName: z.string().min(1, 'Kerberos service name is required'),
  krb5Config: z.string().min(1, 'Kerberos configuration is required'),
  krb5ConfigFileName: z.string().optional(), // Store the filename for UI display
  // useTicketCache: z.optional(z.boolean()),
  // ticketCachePath: z.optional(z.string()),
  truststore: TruststoreFormSchema.optional(),
})

const SaslOauthbearerFormSchema = z.object({
  oauthBearerToken: z.string().min(1, 'OAuth bearer token is required'),
  // tokenEndpoint: z.string().min(1, 'Token endpoint is required'),
  // clientId: z.string().min(1, 'Client ID is required'),
  // clientSecret: z.string().min(1, 'Client secret is required'),
})

const SaslScram256FormSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  truststore: TruststoreFormSchema.optional(),
  consumerGroup: z.string().optional(),
})

const SaslScram512FormSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  truststore: TruststoreFormSchema.optional(),
  consumerGroup: z.string().optional(),
})

const DelegationTokensFormSchema = z.object({
  delegationToken: z.string().min(1, 'Delegation token is required'),
})

const LdapFormSchema = z.object({
  ldapServerUrl: z.string().min(1, 'LDAP server URL is required'),
  ldapServerPort: z.string().min(1, 'LDAP server port is required'),
  ldapBindDn: z.string().min(1, 'LDAP bind DN is required'),
  ldapBindPassword: z.string().min(1, 'LDAP bind password is required'),
  ldapUserSearchFilter: z.optional(z.string().min(1, 'LDAP user search filter is required')),
  ldapBaseDn: z.optional(z.string().min(1, 'LDAP base DN is required')),
})

const AwsIamFormSchema = z.object({
  awsRegion: z.string().min(1, 'AWS region is required'),
  awsAccessKey: z.string().min(1, 'AWS access key is required'),
  awsAccessKeySecret: z.string().min(1, 'AWS access key secret is required'),
  awsAuthorizationIdentity: z.string().optional(), // UserId or RoleId
  awsIAMRoleArn: z.string().optional(),
  awsSessionToken: z.string().optional(),
})

const MtlsFormSchema = z.object({
  clientCert: z.string().min(1, 'Client certificate is required'),
  clientKey: z.string().min(1, 'Client key is required'),
  password: z.string().min(1, 'Password is required'),
})

// First, define a base schema with the common fields
const KafkaConnectionBaseSchema = z.object({
  authMethod: z.string(),
  securityProtocol: z.string(),
  bootstrapServers: z.string().min(1, 'Bootstrap servers are required'),
  isConnected: z.boolean().optional(),
})

// Helper function to check if security protocol requires SSL/TLS
const requiresSSL = (securityProtocol: string): boolean => {
  return securityProtocol === 'SASL_SSL' || securityProtocol === 'SSL'
}

// Then, create a discriminated union for the different auth methods
const KafkaConnectionFormSchema = z
  .discriminatedUnion('authMethod', [
    // SASL/PLAIN
    KafkaConnectionBaseSchema.extend({
      authMethod: z.literal('SASL/PLAIN'),
      saslPlain: SaslPlainFormSchema,
    }),

    // SASL/JAAS
    KafkaConnectionBaseSchema.extend({
      authMethod: z.literal('SASL/JAAS'),
      saslJaas: SaslJaasFormSchema,
    }),

    // SASL/GSSAPI
    KafkaConnectionBaseSchema.extend({
      authMethod: z.literal('SASL/GSSAPI'),
      saslGssapi: SaslGssapiFormSchema,
    }),

    // Add the rest of your auth methods following the same pattern
    KafkaConnectionBaseSchema.extend({
      authMethod: z.literal('SASL/OAUTHBEARER'),
      saslOauthbearer: SaslOauthbearerFormSchema,
    }),

    KafkaConnectionBaseSchema.extend({
      authMethod: z.literal('SASL/SCRAM-256'),
      saslScram256: SaslScram256FormSchema,
    }),

    KafkaConnectionBaseSchema.extend({
      authMethod: z.literal('SASL/SCRAM-512'),
      saslScram512: SaslScram512FormSchema,
    }),

    KafkaConnectionBaseSchema.extend({
      authMethod: z.literal('AWS_MSK_IAM'),
      awsIam: AwsIamFormSchema,
    }),

    KafkaConnectionBaseSchema.extend({
      authMethod: z.literal('Delegation tokens'),
      delegationTokens: DelegationTokensFormSchema,
    }),

    KafkaConnectionBaseSchema.extend({
      authMethod: z.literal('SASL/LDAP'),
      ldap: LdapFormSchema,
    }),

    KafkaConnectionBaseSchema.extend({
      authMethod: z.literal('mTLS'),
      mtls: MtlsFormSchema,
    }),

    // NO_AUTH - Not actual auth method, it is used to avoid sending auth credentials to Kafka
    KafkaConnectionBaseSchema.extend({
      authMethod: z.literal('NO_AUTH'),
      noAuth: NoAuthFormSchema,
    }),
  ])
  .superRefine((data, ctx) => {
    // Validate certificate requirement based on security protocol at the top level
    // This has access to both authMethod and securityProtocol
    const needsSSL = requiresSSL(data.securityProtocol)

    if (needsSSL) {
      // Check if the auth method supports truststore and if certificate is provided
      if (data.authMethod === 'SASL/PLAIN' && data.saslPlain) {
        if (!data.saslPlain.truststore?.certificates || data.saslPlain.truststore.certificates.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Certificate is required when using SSL/TLS',
            path: ['saslPlain', 'truststore', 'certificates'],
          })
        }
      } else if (data.authMethod === 'NO_AUTH' && data.noAuth) {
        if (!data.noAuth.truststore?.certificates || data.noAuth.truststore.certificates.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Certificate is required when using SSL/TLS',
            path: ['noAuth', 'truststore', 'certificates'],
          })
        }
      } else if (data.authMethod === 'SASL/GSSAPI' && data.saslGssapi) {
        if (!data.saslGssapi.truststore?.certificates || data.saslGssapi.truststore.certificates.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Certificate is required when using SSL/TLS',
            path: ['saslGssapi', 'truststore', 'certificates'],
          })
        }
      } else if (data.authMethod === 'SASL/SCRAM-256' && data.saslScram256) {
        if (!data.saslScram256.truststore?.certificates || data.saslScram256.truststore.certificates.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Certificate is required when using SSL/TLS',
            path: ['saslScram256', 'truststore', 'certificates'],
          })
        }
      } else if (data.authMethod === 'SASL/SCRAM-512' && data.saslScram512) {
        if (!data.saslScram512.truststore?.certificates || data.saslScram512.truststore.certificates.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Certificate is required when using SSL/TLS',
            path: ['saslScram512', 'truststore', 'certificates'],
          })
        }
      }
    }
  })

// extract the inferred type
type KafkaMetaForm = z.infer<typeof KafkaMetaFormSchema>
type KafkaBaseForm = z.infer<typeof KafkaBaseFormSchema>
type SaslPlainForm = z.infer<typeof SaslPlainFormSchema>
type SaslJaasForm = z.infer<typeof SaslJaasFormSchema>
type SaslGssapiForm = z.infer<typeof SaslGssapiFormSchema>
type SaslOauthbearerForm = z.infer<typeof SaslOauthbearerFormSchema>
type SaslScram256Form = z.infer<typeof SaslScram256FormSchema>
type SaslScram512Form = z.infer<typeof SaslScram512FormSchema>
type AwsIamForm = z.infer<typeof AwsIamFormSchema>
type DelegationTokensForm = z.infer<typeof DelegationTokensFormSchema>
type LdapForm = z.infer<typeof LdapFormSchema>
type MtlsForm = z.infer<typeof MtlsFormSchema>
type TruststoreForm = z.infer<typeof TruststoreFormSchema>
type KafkaConnectionForm = z.infer<typeof KafkaConnectionFormSchema>
type NoAuthForm = z.infer<typeof NoAuthFormSchema>

// Export the schemas (for validation)
export {
  KafkaMetaFormSchema,
  KafkaBaseFormSchema,
  SaslPlainFormSchema,
  SaslJaasFormSchema,
  SaslGssapiFormSchema,
  SaslOauthbearerFormSchema,
  SaslScram256FormSchema,
  SaslScram512FormSchema,
  AwsIamFormSchema,
  DelegationTokensFormSchema,
  LdapFormSchema,
  MtlsFormSchema,
  TruststoreFormSchema,
  KafkaConnectionFormSchema,
  NoAuthFormSchema,
}

// Export the types (for TypeScript)
export type {
  KafkaMetaForm as KafkaMetaFormType,
  KafkaBaseForm as KafkaBaseFormType,
  SaslPlainForm as SaslPlainFormType,
  SaslJaasForm as SaslJaasFormType,
  SaslGssapiForm as SaslGssapiFormType,
  SaslOauthbearerForm as SaslOauthbearerFormType,
  SaslScram256Form as SaslScram256FormType,
  SaslScram512Form as SaslScram512FormType,
  AwsIamForm as AwsIamFormType,
  DelegationTokensForm as DelegationTokensFormType,
  LdapForm as LdapFormType,
  MtlsForm as MtlsFormType,
  TruststoreForm as TruststoreFormType,
  KafkaConnectionForm as KafkaConnectionFormType,
  NoAuthForm as NoAuthFormType,
}
