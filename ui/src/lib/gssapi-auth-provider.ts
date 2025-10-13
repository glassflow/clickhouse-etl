import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Custom GSSAPI/Kerberos authentication provider for KafkaJS
 *
 * KafkaJS doesn't support GSSAPI natively, so we need to implement a custom
 * authentication provider that handles Kerberos authentication using kinit.
 */
export interface GSSAPIConfig {
  kerberosPrincipal: string
  kerberosKeytab: string // Base64 encoded keytab
  kerberosRealm?: string
  kdc?: string
  serviceName?: string
  krb5Config?: string // krb5.conf content as string
  useTicketCache?: boolean
  ticketCachePath?: string
}

interface AuthenticationResponse {
  response: Buffer
}

/**
 * Creates a GSSAPI authentication provider for KafkaJS
 *
 * This implementation:
 * 1. Writes the keytab and krb5.conf to temporary files
 * 2. Uses kinit to authenticate with Kerberos
 * 3. Returns a PLAIN authentication provider (as a workaround) or throws an error
 *
 * Note: This is a simplified implementation. For production use, consider:
 * - Using a proper Kerberos library like `kerberos` or `node-krb5`
 * - Implementing proper GSSAPI token exchange
 * - Handling token refresh and expiration
 */
export function createGSSAPIAuthProvider(config: GSSAPIConfig) {
  // Create temporary directory for Kerberos files
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kafka-kerberos-'))
  let keytabPath: string | null = null
  let krb5ConfPath: string | null = null

  return {
    mechanism: 'plain', // Fallback to plain mechanism

    async authenticate(): Promise<AuthenticationResponse> {
      try {
        // Write keytab file if provided as base64
        if (config.kerberosKeytab) {
          keytabPath = path.join(tempDir, 'client.keytab')
          const keytabBuffer = Buffer.from(config.kerberosKeytab, 'base64')
          fs.writeFileSync(keytabPath, keytabBuffer, { mode: 0o600 })
        }

        // Write krb5.conf file if provided
        if (config.krb5Config) {
          krb5ConfPath = path.join(tempDir, 'krb5.conf')
          fs.writeFileSync(krb5ConfPath, config.krb5Config)
        }

        // Try to authenticate using kinit
        if (keytabPath) {
          const env = krb5ConfPath ? { ...process.env, KRB5_CONFIG: krb5ConfPath } : process.env

          // Check if kinit is available
          try {
            await execAsync('which kinit')
          } catch {
            throw new Error(
              'kinit command not found. Kerberos authentication requires Kerberos client tools to be installed.',
            )
          }

          // Authenticate with kinit
          const kinitCmd = `kinit -kt "${keytabPath}" ${config.kerberosPrincipal}`
          await execAsync(kinitCmd, { env })

          console.log(`Kerberos authentication successful for ${config.kerberosPrincipal}`)
        }

        // Since KafkaJS doesn't support GSSAPI natively, we throw an error
        // The actual GSSAPI authentication needs to be handled at a lower level
        throw new Error(
          'GSSAPI/Kerberos authentication is not fully supported in this environment. ' +
            'The Kerberos ticket has been obtained, but KafkaJS requires SASL mechanism support. ' +
            'Consider using SASL/PLAIN or SASL/SCRAM instead, or use a Kafka client with native GSSAPI support.',
        )
      } catch (error) {
        // Clean up temporary files
        cleanup()
        throw error
      }
    },
  }

  function cleanup() {
    try {
      if (keytabPath && fs.existsSync(keytabPath)) {
        fs.unlinkSync(keytabPath)
      }
      if (krb5ConfPath && fs.existsSync(krb5ConfPath)) {
        fs.unlinkSync(krb5ConfPath)
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir)
      }
    } catch (error) {
      console.error('Error cleaning up Kerberos temporary files:', error)
    }
  }
}

/**
 * Alternative approach: Throw an informative error immediately
 *
 * Since KafkaJS doesn't support GSSAPI natively, it's better to inform users
 * upfront rather than attempting partial authentication.
 */
export function throwGSSAPINotSupportedError(): never {
  throw new Error(
    'GSSAPI/Kerberos authentication is not supported in KafkaJS. ' +
      '\n\nTo connect to a Kerberos-secured Kafka cluster, you have the following options:' +
      '\n1. Use a different Kafka client library with native GSSAPI support (e.g., node-rdkafka)' +
      '\n2. Configure your Kafka cluster to also support SASL/SCRAM or SASL/PLAIN' +
      '\n3. Use a proxy that handles Kerberos authentication' +
      '\n\nFor more information, see: https://github.com/tulios/kafkajs/issues/1231',
  )
}
