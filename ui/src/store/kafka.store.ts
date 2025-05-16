import { StateCreator } from 'zustand'
import {
  SaslPlainFormType,
  SaslJaasFormType,
  SaslGssapiFormType,
  SaslOauthbearerFormType,
  SaslScram256FormType,
  SaslScram512FormType,
  AwsIamFormType,
  DelegationTokensFormType,
  LdapFormType,
  MtlsFormType,
  TruststoreFormType,
  KafkaConnectionFormType,
} from '@/src/scheme/kafka.scheme'

export interface KafkaStore {
  // status
  isConnected: boolean

  skipAuth: boolean

  // base values
  authMethod: string
  securityProtocol: string
  bootstrapServers: string

  // sasl connection types
  saslPlain: SaslPlainFormType
  saslJaas: SaslJaasFormType
  saslGssapi: SaslGssapiFormType
  saslOauthbearer: SaslOauthbearerFormType
  saslScram256: SaslScram256FormType
  saslScram512: SaslScram512FormType

  // aws iam connection type
  awsIam: AwsIamFormType

  // delegation tokens connection type
  delegationTokens: DelegationTokensFormType

  // ldap connection type
  ldap: LdapFormType

  // mtls connection type
  mtls: MtlsFormType

  // ssl - truststore connection type
  truststore: TruststoreFormType

  // base actions
  setKafkaAuthMethod: (authMethod: string) => void
  setKafkaSecurityProtocol: (securityProtocol: string) => void
  setKafkaBootstrapServers: (bootstrapServers: string) => void

  // sasl actions
  setKafkaSaslPlain: (saslPlain: SaslPlainFormType) => void
  setKafkaSaslJaas: (saslJaas: SaslJaasFormType) => void
  setKafkaSaslGssapi: (saslGssapi: SaslGssapiFormType) => void
  setKafkaSaslOauthbearer: (saslOauthbearer: SaslOauthbearerFormType) => void
  setKafkaSaslScram256: (saslScram256: SaslScram256FormType) => void
  setKafkaSaslScram512: (saslScram512: SaslScram512FormType) => void

  // aws iam actions
  setKafkaAwsIam: (awsIam: AwsIamFormType) => void

  // delegation tokens actions
  setKafkaDelegationTokens: (delegationTokens: DelegationTokensFormType) => void

  // ldap actions
  setKafkaLdap: (ldap: LdapFormType) => void

  // mtls actions
  setKafkaMtls: (mtls: MtlsFormType) => void

  // ssl - truststore actions
  setKafkaTruststore: (truststore: TruststoreFormType) => void

  // kafka connection actions
  setKafkaConnection: (connection: KafkaConnectionFormType) => void

  setKafkaSkipAuth: (skipAuth: boolean) => void

  // status actions
  setIsConnected: (isConnected: boolean) => void

  getIsKafkaConnectionDirty: () => boolean
}

export interface KafkaSlice {
  kafkaStore: KafkaStore
}

export const createKafkaSlice: StateCreator<KafkaSlice> = (set, get) => ({
  kafkaStore: {
    // base values
    authMethod: '',
    securityProtocol: '',
    bootstrapServers: '',
    skipAuth: false,
    // status
    isConnected: false,

    // sasl connection types
    saslPlain: {
      username: '',
      password: '',
      consumerGroup: '',
    },
    saslJaas: {
      jaasConfig: '',
    },
    saslGssapi: {
      kerberosPrincipal: '',
      kerberosKeytab: '',
    },
    saslOauthbearer: {
      oauthBearerToken: '',
    },
    saslScram256: {
      username: '',
      password: '',
      consumerGroup: '',
    },
    saslScram512: {
      username: '',
      password: '',
      consumerGroup: '',
    },

    // aws iam connection type
    awsIam: {
      awsRegion: '',
      awsIAMRoleArn: '',
      awsAccessKey: '',
      awsAccessKeySecret: '',
    },

    // delegation tokens connection type
    delegationTokens: {
      delegationToken: '',
    },

    // ldap connection type
    ldap: {
      ldapServerUrl: '',
      ldapServerPort: '',
      ldapBindDn: '',
      ldapBindPassword: '',
      ldapUserSearchFilter: '',
      ldapBaseDn: '',
    },

    // mtls connection type
    mtls: {
      clientCert: '',
      clientKey: '',
      password: '',
    },

    // ssl - truststore connection type
    truststore: {
      location: '',
      password: '',
      type: '',
      algorithm: '',
      certificates: '',
    },

    // base actions
    setKafkaAuthMethod: (authMethod: string) => set((state) => ({ kafkaStore: { ...state.kafkaStore, authMethod } })),
    setKafkaSkipAuth: (skipAuth: boolean) => set((state) => ({ kafkaStore: { ...state.kafkaStore, skipAuth } })),
    setKafkaSecurityProtocol: (securityProtocol: string) =>
      set((state) => ({ kafkaStore: { ...state.kafkaStore, securityProtocol } })),
    setKafkaBootstrapServers: (bootstrapServers: string) =>
      set((state) => ({ kafkaStore: { ...state.kafkaStore, bootstrapServers } })),

    // sasl actions
    setKafkaSaslPlain: (saslPlain: SaslPlainFormType) =>
      set((state) => ({ kafkaStore: { ...state.kafkaStore, saslPlain } })),
    setKafkaSaslJaas: (saslJaas: SaslJaasFormType) =>
      set((state) => ({ kafkaStore: { ...state.kafkaStore, saslJaas } })),
    setKafkaSaslGssapi: (saslGssapi: SaslGssapiFormType) =>
      set((state) => ({ kafkaStore: { ...state.kafkaStore, saslGssapi } })),
    setKafkaSaslOauthbearer: (saslOauthbearer: SaslOauthbearerFormType) =>
      set((state) => ({ kafkaStore: { ...state.kafkaStore, saslOauthbearer } })),
    setKafkaSaslScram256: (saslScram256: SaslScram256FormType) =>
      set((state) => ({ kafkaStore: { ...state.kafkaStore, saslScram256 } })),
    setKafkaSaslScram512: (saslScram512: SaslScram512FormType) =>
      set((state) => ({ kafkaStore: { ...state.kafkaStore, saslScram512 } })),

    // aws iam actions
    setKafkaAwsIam: (awsIam: AwsIamFormType) => set((state) => ({ kafkaStore: { ...state.kafkaStore, awsIam } })),

    // delegation tokens actions
    setKafkaDelegationTokens: (delegationTokens: DelegationTokensFormType) =>
      set((state) => ({ kafkaStore: { ...state.kafkaStore, delegationTokens } })),

    // ldap actions
    setKafkaLdap: (ldap: LdapFormType) => set((state) => ({ kafkaStore: { ...state.kafkaStore, ldap } })),

    // mtls actions
    setKafkaMtls: (mtls: MtlsFormType) => set((state) => ({ kafkaStore: { ...state.kafkaStore, mtls } })),

    // ssl - truststore actions
    setKafkaTruststore: (truststore: TruststoreFormType) =>
      set((state) => ({ kafkaStore: { ...state.kafkaStore, truststore } })),

    // kafka connection actions
    setKafkaConnection: (connection: KafkaConnectionFormType) =>
      set((state) => ({ kafkaStore: { ...state.kafkaStore, ...connection } })),

    // status actions
    setIsConnected: (isConnected: boolean) => set((state) => ({ kafkaStore: { ...state.kafkaStore, isConnected } })),
    getIsKafkaConnectionDirty: () => {
      const {
        authMethod,
        securityProtocol,
        bootstrapServers,
        saslPlain,
        saslJaas,
        saslGssapi,
        saslOauthbearer,
        saslScram256,
        saslScram512,
        awsIam,
        delegationTokens,
        ldap,
        mtls,
        truststore,
      } = get().kafkaStore

      const dirtyFields = Object.entries({
        authMethod,
        securityProtocol,
        bootstrapServers,
      }).filter(([key, value]) => value !== '')

      return Object.values({
        authMethod,
        securityProtocol,
        bootstrapServers,
      }).some((value) => value !== '')
    },
  },
})
