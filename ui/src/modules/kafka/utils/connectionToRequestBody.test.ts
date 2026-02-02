import { describe, it, expect } from 'vitest'
import type { KafkaConnectionFormType } from '@/src/scheme'
import { connectionFormToRequestBody } from './connectionToRequestBody'

describe('connectionFormToRequestBody', () => {
  describe('base shape', () => {
    it('includes servers, securityProtocol, authMethod from values for any auth method', () => {
      const values = {
        authMethod: 'NO_AUTH' as const,
        securityProtocol: 'PLAINTEXT',
        bootstrapServers: 'localhost:9092',
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.servers).toBe('localhost:9092')
      expect(result.securityProtocol).toBe('PLAINTEXT')
      expect(result.authMethod).toBe('NO_AUTH')
    })
  })

  describe('NO_AUTH', () => {
    it('includes skipTlsVerification from noAuth.truststore when true', () => {
      const values = {
        authMethod: 'NO_AUTH' as const,
        securityProtocol: 'SSL',
        bootstrapServers: 'localhost:9092',
        noAuth: { truststore: { skipTlsVerification: true } },
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.skipTlsVerification).toBe(true)
    })

    it('includes certificate when noAuth.truststore.certificates is set', () => {
      const cert = '-----BEGIN CERTIFICATE-----'
      const values = {
        authMethod: 'NO_AUTH' as const,
        securityProtocol: 'SSL',
        bootstrapServers: 'localhost:9092',
        noAuth: { truststore: { certificates: cert } },
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.certificate).toBe(cert)
    })

    it('does not include certificate when truststore has no certificates', () => {
      const values = {
        authMethod: 'NO_AUTH' as const,
        securityProtocol: 'PLAINTEXT',
        bootstrapServers: 'localhost:9092',
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.certificate).toBeUndefined()
    })
  })

  describe('SASL/PLAIN', () => {
    it('includes username, password, consumerGroup and optional truststore', () => {
      const values = {
        authMethod: 'SASL/PLAIN' as const,
        securityProtocol: 'SASL_PLAINTEXT',
        bootstrapServers: 'localhost:9092',
        saslPlain: {
          username: 'user',
          password: 'pass',
          consumerGroup: 'cg',
          truststore: { skipTlsVerification: true, certificates: 'cert' },
        },
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.username).toBe('user')
      expect(result.password).toBe('pass')
      expect(result.consumerGroup).toBe('cg')
      expect(result.skipTlsVerification).toBe(true)
      expect(result.certificate).toBe('cert')
    })
  })

  describe('SASL/SCRAM-256 and SASL/SCRAM-512', () => {
    it('SASL/SCRAM-256: includes username, password, consumerGroup and skipTlsVerification from truststore', () => {
      const values = {
        authMethod: 'SASL/SCRAM-256' as const,
        securityProtocol: 'SASL_SSL',
        bootstrapServers: 'localhost:9092',
        saslScram256: {
          username: 'u',
          password: 'p',
          consumerGroup: 'cg',
          truststore: { skipTlsVerification: true },
        },
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.username).toBe('u')
      expect(result.password).toBe('p')
      expect(result.consumerGroup).toBe('cg')
      expect(result.skipTlsVerification).toBe(true)
    })

    it('SASL/SCRAM-512: includes certificate when truststore.certificates is set', () => {
      const values = {
        authMethod: 'SASL/SCRAM-512' as const,
        securityProtocol: 'SASL_SSL',
        bootstrapServers: 'localhost:9092',
        saslScram512: { username: 'u', password: 'p', truststore: { certificates: 'cert' } },
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.certificate).toBe('cert')
    })
  })

  describe('SASL/GSSAPI', () => {
    it('includes Kerberos fields and optional truststore certificate', () => {
      const values = {
        authMethod: 'SASL/GSSAPI' as const,
        securityProtocol: 'SASL_SSL',
        bootstrapServers: 'localhost:9092',
        saslGssapi: {
          kerberosPrincipal: 'principal',
          kerberosKeytab: 'keytab',
          kerberosRealm: 'realm',
          kdc: 'kdc',
          serviceName: 'kafka',
          krb5Config: 'config',
          truststore: { certificates: 'cert' },
        },
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.kerberosPrincipal).toBe('principal')
      expect(result.kerberosKeytab).toBe('keytab')
      expect(result.kerberosRealm).toBe('realm')
      expect(result.kdc).toBe('kdc')
      expect(result.serviceName).toBe('kafka')
      expect(result.krb5Config).toBe('config')
      expect(result.certificate).toBe('cert')
    })
  })

  describe('SASL/JAAS', () => {
    it('includes jaasConfig', () => {
      const values = {
        authMethod: 'SASL/JAAS' as const,
        securityProtocol: 'SASL_PLAINTEXT',
        bootstrapServers: 'localhost:9092',
        saslJaas: { jaasConfig: 'com.sun.security.auth.module.Krb5LoginModule required;' },
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.jaasConfig).toBe('com.sun.security.auth.module.Krb5LoginModule required;')
    })
  })

  describe('SASL/OAUTHBEARER', () => {
    it('includes oauthBearerToken', () => {
      const values = {
        authMethod: 'SASL/OAUTHBEARER' as const,
        securityProtocol: 'SASL_PLAINTEXT',
        bootstrapServers: 'localhost:9092',
        saslOauthbearer: { oauthBearerToken: 'token' },
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.oauthBearerToken).toBe('token')
    })
  })

  describe('AWS_MSK_IAM', () => {
    it('includes awsAccessKey, awsAccessKeySecret, awsRegion', () => {
      const values = {
        authMethod: 'AWS_MSK_IAM' as const,
        securityProtocol: 'SASL_SSL',
        bootstrapServers: 'localhost:9092',
        awsIam: { awsAccessKey: 'key', awsAccessKeySecret: 'secret', awsRegion: 'us-east-1' },
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.awsAccessKey).toBe('key')
      expect(result.awsAccessKeySecret).toBe('secret')
      expect(result.awsRegion).toBe('us-east-1')
    })
  })

  describe('Delegation tokens', () => {
    it('includes delegationToken', () => {
      const values = {
        authMethod: 'Delegation tokens' as const,
        securityProtocol: 'SASL_PLAINTEXT',
        bootstrapServers: 'localhost:9092',
        delegationTokens: { delegationToken: 'dt' },
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.delegationToken).toBe('dt')
    })
  })

  describe('SASL/LDAP', () => {
    it('includes ldap fields', () => {
      const values = {
        authMethod: 'SASL/LDAP' as const,
        securityProtocol: 'SASL_PLAINTEXT',
        bootstrapServers: 'localhost:9092',
        ldap: {
          ldapServerUrl: 'ldap://host',
          ldapServerPort: '389',
          ldapBindDn: 'dn',
          ldapBindPassword: 'pwd',
          ldapUserSearchFilter: 'filter',
          ldapBaseDn: 'base',
        },
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.ldapServerUrl).toBe('ldap://host')
      expect(result.ldapServerPort).toBe('389')
      expect(result.ldapBindDn).toBe('dn')
      expect(result.ldapBindPassword).toBe('pwd')
      expect(result.ldapUserSearchFilter).toBe('filter')
      expect(result.ldapBaseDn).toBe('base')
    })
  })

  describe('mTLS', () => {
    it('includes clientCert, clientKey, password', () => {
      const values = {
        authMethod: 'mTLS' as const,
        securityProtocol: 'SSL',
        bootstrapServers: 'localhost:9092',
        mtls: { clientCert: 'cert', clientKey: 'key', password: 'pwd' },
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.clientCert).toBe('cert')
      expect(result.clientKey).toBe('key')
      expect(result.password).toBe('pwd')
    })
  })

  describe('edge: skipTlsVerification', () => {
    it('omits or sets skipTlsVerification false when not set', () => {
      const values = {
        authMethod: 'NO_AUTH' as const,
        securityProtocol: 'PLAINTEXT',
        bootstrapServers: 'localhost:9092',
      } as KafkaConnectionFormType
      const result = connectionFormToRequestBody(values)
      expect(result.skipTlsVerification).toBeUndefined()
    })
  })
})
