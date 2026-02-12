import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  KafkaClientFactory,
  createKafkaClient,
  isKerberosSupported,
  getSupportedAuthMethods,
} from '../kafka-client-factory'
import { KafkaGatewayClient } from '../kafka-gateway-client'
import { KafkaClientType } from '../kafka-client-interface'

// Mock the kafka-client module to avoid importing the actual KafkaJS
vi.mock('../kafka-client', () => {
  return {
    KafkaClient: vi.fn().mockImplementation((config) => ({
      config,
      connect: vi.fn(),
      disconnect: vi.fn(),
      listTopics: vi.fn(),
      testConnection: vi.fn(),
      _isMockKafkaJSClient: true,
    })),
  }
})

// Mock the kafka-gateway-client module
vi.mock('../kafka-gateway-client', () => {
  return {
    KafkaGatewayClient: vi.fn().mockImplementation((config) => ({
      config,
      connect: vi.fn(),
      disconnect: vi.fn(),
      listTopics: vi.fn(),
      testConnection: vi.fn(),
      _isMockGatewayClient: true,
    })),
  }
})

describe('KafkaClientFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createClient', () => {
    describe('SASL/GSSAPI (Kerberos) authentication', () => {
      it('returns KafkaGatewayClient for SASL/GSSAPI auth method', async () => {
        const config = {
          brokers: ['localhost:9092'],
          authMethod: 'SASL/GSSAPI',
          kerberosPrincipal: 'kafka/kafka@EXAMPLE.COM',
          kerberosKeytab: 'base64keytab',
          krb5Config: 'base64krb5',
        }

        const client = await KafkaClientFactory.createClient(config)

        expect(KafkaGatewayClient).toHaveBeenCalledWith(config)
        expect((client as any)._isMockGatewayClient).toBe(true)
      })
    })

    describe('other authentication methods', () => {
      const nonKerberosAuthMethods = [
        'NO_AUTH',
        'SASL/PLAIN',
        'SASL/SCRAM-256',
        'SASL/SCRAM-512',
        'AWS_MSK_IAM',
        'mTLS',
        'SSL',
        'SASL/JAAS',
        'SASL/OAUTHBEARER',
        'Delegation tokens',
        'SASL/LDAP',
      ]

      it.each(nonKerberosAuthMethods)('returns KafkaClient for %s auth method', async (authMethod) => {
        const config = {
          brokers: ['localhost:9092'],
          authMethod,
          username: 'test',
          password: 'test',
        }

        const client = await KafkaClientFactory.createClient(config)

        expect((client as any)._isMockKafkaJSClient).toBe(true)
      })

      it('returns KafkaClient when authMethod is undefined', async () => {
        const config = {
          brokers: ['localhost:9092'],
        }

        const client = await KafkaClientFactory.createClient(config)

        expect((client as any)._isMockKafkaJSClient).toBe(true)
      })
    })
  })

  describe('isAuthMethodSupported', () => {
    it('returns true for SASL/GSSAPI', () => {
      expect(KafkaClientFactory.isAuthMethodSupported('SASL/GSSAPI')).toBe(true)
    })

    it('returns true for SASL/PLAIN', () => {
      expect(KafkaClientFactory.isAuthMethodSupported('SASL/PLAIN')).toBe(true)
    })

    it('returns true for AWS_MSK_IAM', () => {
      expect(KafkaClientFactory.isAuthMethodSupported('AWS_MSK_IAM')).toBe(true)
    })

    it('returns true for any auth method (all are supported)', () => {
      expect(KafkaClientFactory.isAuthMethodSupported('UNKNOWN_METHOD')).toBe(true)
    })
  })

  describe('getSupportedAuthMethods', () => {
    it('returns all supported authentication methods', () => {
      const methods = KafkaClientFactory.getSupportedAuthMethods()

      expect(methods).toContain('NO_AUTH')
      expect(methods).toContain('SASL/PLAIN')
      expect(methods).toContain('SASL/SCRAM-256')
      expect(methods).toContain('SASL/SCRAM-512')
      expect(methods).toContain('AWS_MSK_IAM')
      expect(methods).toContain('mTLS')
      expect(methods).toContain('SSL')
      expect(methods).toContain('SASL/GSSAPI')
    })

    it('returns array with expected length', () => {
      const methods = KafkaClientFactory.getSupportedAuthMethods()
      expect(methods.length).toBe(8)
    })
  })
})

describe('createKafkaClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is a convenience function that delegates to KafkaClientFactory.createClient', async () => {
    const config = {
      brokers: ['localhost:9092'],
      authMethod: 'SASL/PLAIN',
      username: 'test',
      password: 'test',
    }

    const client = await createKafkaClient(config)

    expect((client as any)._isMockKafkaJSClient).toBe(true)
  })

  it('returns KafkaGatewayClient for Kerberos config', async () => {
    const config = {
      brokers: ['localhost:9092'],
      authMethod: 'SASL/GSSAPI',
      kerberosPrincipal: 'kafka@EXAMPLE.COM',
      kerberosKeytab: 'base64keytab',
      krb5Config: 'base64krb5',
    }

    const client = await createKafkaClient(config)

    expect((client as any)._isMockGatewayClient).toBe(true)
  })
})

describe('isKerberosSupported', () => {
  it('returns true (Kerberos is supported via Gateway)', () => {
    expect(isKerberosSupported()).toBe(true)
  })
})

describe('getSupportedAuthMethods', () => {
  it('delegates to KafkaClientFactory.getSupportedAuthMethods', () => {
    const methods = getSupportedAuthMethods()
    const factoryMethods = KafkaClientFactory.getSupportedAuthMethods()

    expect(methods).toEqual(factoryMethods)
  })
})
