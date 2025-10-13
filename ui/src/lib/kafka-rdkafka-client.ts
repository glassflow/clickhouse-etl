/**
 * RdKafka Client Implementation
 *
 * Uses node-rdkafka (librdkafka wrapper) for Kerberos (SASL/GSSAPI) support
 * This is a native addon that provides full Kafka protocol support including Kerberos
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  IKafkaClient,
  KafkaConfig,
  KafkaMessage,
  TopicMetadata,
  KafkaConnectionError,
  KafkaAuthenticationError,
} from './kafka-client-interface'

// Dynamically import node-rdkafka only when needed
let Kafka: any = null

// Only attempt to load node-rdkafka on server-side
if (typeof window === 'undefined') {
  try {
    // Dynamic import to avoid bundling in client-side code
    // We use dynamic import for optional native module
    import('node-rdkafka')
      .then((module) => {
        Kafka = module.default || module
      })
      .catch(() => {
        console.warn('node-rdkafka not installed. Kerberos authentication will not be available.')
      })
  } catch (error) {
    console.warn('node-rdkafka not installed. Kerberos authentication will not be available.')
  }
}

export class RdKafkaClient implements IKafkaClient {
  private producer: any = null
  private consumer: any = null
  private config: KafkaConfig
  private isConnected: boolean = false
  private tempCertFiles: string[] = []

  constructor(config: KafkaConfig) {
    if (!Kafka) {
      throw new Error(
        'node-rdkafka is not installed. Install it with: npm install node-rdkafka\n' +
          'Note: librdkafka must be installed on your system first.',
      )
    }

    this.config = config
  }

  async connect(): Promise<void> {
    try {
      const rdkafkaConfig = this.buildRdKafkaConfig()
      console.log('[RdKafka] Configuration:', JSON.stringify(rdkafkaConfig, null, 2))

      // Create producer with minimal configuration and proper error handling
      try {
        this.producer = new Kafka.Producer(rdkafkaConfig)
        console.log('[RdKafka] Producer created successfully')
      } catch (error) {
        console.error('[RdKafka] Failed to create producer:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new KafkaConnectionError(`Failed to create producer: ${errorMessage}`)
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new KafkaConnectionError('Connection timeout after 10 seconds'))
        }, 10000)

        this.producer.on('ready', () => {
          clearTimeout(timeout)
          this.isConnected = true
          console.log('[RdKafka] Producer connected successfully')
          resolve()
        })

        this.producer.on('event.error', (err: Error) => {
          clearTimeout(timeout)
          console.error('[RdKafka] Producer error:', err)

          if (err.message.includes('authentication') || err.message.includes('SASL')) {
            reject(new KafkaAuthenticationError('Kerberos authentication failed', err))
          } else {
            reject(new KafkaConnectionError('Failed to connect to Kafka', err))
          }
        })

        this.producer.on('event.log', (log: any) => {
          console.log('[RdKafka] Log:', log)
        })

        // Use a timeout to prevent hanging if producer.connect() causes issues
        const connectTimeout = setTimeout(() => {
          reject(new KafkaConnectionError('Producer connect() timed out - possible segfault'))
        }, 5000)

        try {
          this.producer.connect()
          clearTimeout(connectTimeout)
        } catch (error) {
          clearTimeout(connectTimeout)
          reject(new KafkaConnectionError(`Producer connect() failed: ${error}`))
        }
      })
    } catch (error) {
      throw new KafkaConnectionError(
        `Failed to initialize RdKafka client: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      let producerDisconnected = !this.producer
      let consumerDisconnected = !this.consumer

      if (this.producer) {
        this.producer.disconnect((err: Error | null) => {
          if (err) console.error('[RdKafka] Producer disconnect error:', err)
          producerDisconnected = true
          if (producerDisconnected && consumerDisconnected) {
            this.cleanup()
            resolve()
          }
        })
      }

      if (this.consumer) {
        this.consumer.disconnect((err: Error | null) => {
          if (err) console.error('[RdKafka] Consumer disconnect error:', err)
          consumerDisconnected = true
          if (producerDisconnected && consumerDisconnected) {
            this.cleanup()
            resolve()
          }
        })
      }

      if (!this.producer && !this.consumer) {
        this.cleanup()
        resolve()
      }
    })
  }

  async send(topic: string, messages: KafkaMessage[]): Promise<void> {
    if (!this.producer || !this.isConnected) {
      throw new Error('Producer not connected. Call connect() first.')
    }

    return new Promise((resolve, reject) => {
      let sent = 0
      const total = messages.length

      messages.forEach((msg) => {
        try {
          const value = typeof msg.value === 'string' ? Buffer.from(msg.value) : msg.value
          const key = msg.key ? (typeof msg.key === 'string' ? Buffer.from(msg.key) : msg.key) : null

          this.producer.produce(
            topic,
            msg.partition ?? null, // partition (null = automatic)
            value,
            key,
            msg.timestamp ?? Date.now(),
            msg.headers,
          )

          sent++
        } catch (error) {
          reject(error)
          return
        }
      })

      // Flush to ensure all messages are sent
      this.producer.flush(10000, (err: Error | null) => {
        if (err) {
          reject(new Error(`Failed to flush messages: ${err.message}`))
        } else if (sent === total) {
          resolve()
        } else {
          reject(new Error(`Only sent ${sent}/${total} messages`))
        }
      })
    })
  }

  async subscribe(topics: string[], fromBeginning: boolean = false): Promise<void> {
    if (!this.consumer) {
      const consumerConfig = {
        ...this.buildRdKafkaConfig(),
        'group.id': this.config.groupId || 'default-group',
        'enable.auto.commit': false,
        'auto.offset.reset': fromBeginning ? 'earliest' : 'latest',
      }

      this.consumer = new Kafka.KafkaConsumer(consumerConfig, {})

      return new Promise((resolve, reject) => {
        this.consumer.on('ready', () => {
          console.log('[RdKafka] Consumer ready')
          this.consumer.subscribe(topics)
          resolve()
        })

        this.consumer.on('event.error', (err: Error) => {
          console.error('[RdKafka] Consumer error:', err)
          reject(err)
        })

        this.consumer.connect()
      })
    }

    this.consumer.subscribe(topics)
  }

  async consume(callback: (message: KafkaMessage) => void | Promise<void>): Promise<void> {
    if (!this.consumer) {
      throw new Error('Consumer not initialized. Call subscribe() first.')
    }

    this.consumer.on('data', async (data: any) => {
      const message: KafkaMessage = {
        topic: data.topic,
        partition: data.partition,
        offset: data.offset.toString(),
        key: data.key?.toString() ?? null,
        value: data.value.toString(),
        timestamp: data.timestamp,
        headers: data.headers,
      }

      try {
        await callback(message)
        // Auto-commit after successful processing
        this.consumer.commitMessage(data)
      } catch (error) {
        console.error('[RdKafka] Error processing message:', error)
      }
    })

    this.consumer.consume()
  }

  async pause(): Promise<void> {
    if (this.consumer) {
      this.consumer.unsubscribe()
    }
  }

  async resume(): Promise<void> {
    if (this.consumer) {
      // Re-subscribe would be needed, but topics are not stored
      throw new Error('Resume not implemented for RdKafka client')
    }
  }

  async listTopics(): Promise<string[]> {
    if (!this.producer || !this.isConnected) {
      throw new Error('Producer not connected. Call connect() first.')
    }

    return new Promise((resolve, reject) => {
      this.producer.getMetadata({ timeout: 10000 }, (err: Error | null, metadata: any) => {
        if (err) {
          reject(new Error(`Failed to get metadata: ${err.message}`))
        } else {
          const topics = metadata.topics.map((t: any) => t.name)
          resolve(topics)
        }
      })
    })
  }

  async getTopicDetails(): Promise<Array<{ name: string; partitionCount: number }>> {
    if (!this.producer || !this.isConnected) {
      throw new Error('Producer not connected. Call connect() first.')
    }

    return new Promise((resolve, reject) => {
      this.producer.getMetadata({ timeout: 10000 }, (err: Error | null, metadata: any) => {
        if (err) {
          reject(new Error(`Failed to get metadata: ${err.message}`))
        } else {
          const topicDetails = metadata.topics.map((t: any) => ({
            name: t.name,
            partitionCount: t.partitions.length,
          }))
          resolve(topicDetails)
        }
      })
    })
  }

  async getTopicMetadata(topic: string): Promise<TopicMetadata> {
    if (!this.producer || !this.isConnected) {
      throw new Error('Producer not connected. Call connect() first.')
    }

    return new Promise((resolve, reject) => {
      this.producer.getMetadata({ topic, timeout: 10000 }, (err: Error | null, metadata: any) => {
        if (err) {
          reject(new Error(`Failed to get topic metadata: ${err.message}`))
        } else if (!metadata.topics || metadata.topics.length === 0) {
          reject(new Error(`Topic '${topic}' not found`))
        } else {
          const topicMeta = metadata.topics[0]
          resolve({
            name: topicMeta.name,
            partitions: topicMeta.partitions.map((p: any) => ({
              id: p.id,
              leader: p.leader,
              replicas: p.replicas,
              isr: p.isrs || [],
            })),
          })
        }
      })
    })
  }

  async createTopic(topic: string, config?: any): Promise<void> {
    // AdminClient for topic creation
    const adminClient = Kafka.AdminClient.create(this.buildRdKafkaConfig())

    return new Promise((resolve, reject) => {
      const newTopic = {
        topic,
        num_partitions: config?.numPartitions || 1,
        replication_factor: config?.replicationFactor || 1,
        config: config?.config || {},
      }

      adminClient.createTopic(newTopic, (err: Error | null) => {
        adminClient.disconnect()

        if (err) {
          reject(new Error(`Failed to create topic: ${err.message}`))
        } else {
          resolve()
        }
      })
    })
  }

  async testConnection(): Promise<boolean> {
    try {
      // For Kerberos, use a simpler test to avoid segfaults
      console.log('[RdKafka] Testing Kerberos configuration without full connection...')

      // Test kinit command manually
      const { spawn } = await import('child_process')

      if (this.config.kerberosKeytab) {
        let keytabPath: string
        if (this.config.kerberosKeytab.startsWith('/')) {
          // It's a file path, use directly
          keytabPath = this.config.kerberosKeytab
        } else if (this.config.kerberosKeytab.startsWith('data:')) {
          // It's a data URL (from FileReader.readAsDataURL)
          // Extract base64 content from data URL: "data:application/octet-stream;base64,<content>"
          const base64Content = this.config.kerberosKeytab.split(',')[1]
          console.log('[RdKafka] Extracted base64 content for kinit, length:', base64Content.length)
          keytabPath = this.writeTempFile(base64Content, `test-keytab-${Date.now()}.keytab`, true)
        } else {
          // Assume it's raw base64-encoded content
          keytabPath = this.writeTempFile(this.config.kerberosKeytab, `test-keytab-${Date.now()}.keytab`, true)
        }

        console.log('[RdKafka] Testing kinit with keytab:', keytabPath)

        // Create krb5.conf file for kinit
        let krb5Path: string
        if (this.config.krb5Config) {
          krb5Path = this.writeTempFile(this.config.krb5Config, `krb5-test-${Date.now()}.conf`)
          console.log('[RdKafka] Created krb5.conf for kinit:', krb5Path)
        } else {
          krb5Path = '/etc/krb5.conf'
        }

        const kinitProcess = spawn(
          'kinit',
          ['-t', keytabPath, '-k', this.config.kerberosPrincipal || 'admin@EXAMPLE.COM'],
          {
            stdio: 'pipe',
            env: { ...process.env, KRB5_CONFIG: krb5Path },
          },
        )

        return new Promise((resolve) => {
          let errorOutput = ''

          kinitProcess.stderr?.on('data', (data) => {
            errorOutput += data.toString()
          })

          kinitProcess.on('close', (code) => {
            if (code === 0) {
              console.log('[RdKafka] Kerberos authentication test successful')
              resolve(true)
            } else {
              console.error('[RdKafka] Kerberos authentication test failed:', errorOutput)
              resolve(false)
            }
          })

          kinitProcess.on('error', (error) => {
            console.error('[RdKafka] Failed to run kinit:', error)
            resolve(false)
          })
        })
      }

      return false
    } catch (error) {
      console.error('[RdKafka] Connection test failed:', error)
      return false
    }
  }

  /**
   * Build librdkafka configuration object
   */
  private buildRdKafkaConfig(): any {
    const config: any = {
      'client.id': this.config.clientId || 'rdkafka-client',
      'metadata.broker.list': this.config.brokers.join(','),
      'socket.keepalive.enable': true,
      'api.version.request': true,
      'log.connection.close': false,

      // Basic logging and timeout settings
      log_level: 6, // Info level (reduced from debug)
      debug: 'broker', // Reduced debug scope
      'socket.timeout.ms': 5000,
      'api.version.request.timeout.ms': 5000,
      'metadata.request.timeout.ms': 5000,
    }

    // Configure security protocol
    if (this.config.securityProtocol === 'SASL_SSL') {
      config['security.protocol'] = 'sasl_ssl'
    } else if (this.config.securityProtocol === 'SASL_PLAINTEXT') {
      config['security.protocol'] = 'sasl_plaintext'
    } else if (this.config.securityProtocol === 'SSL') {
      config['security.protocol'] = 'ssl'
    } else {
      config['security.protocol'] = 'plaintext'
    }

    // Configure SASL/GSSAPI (Kerberos)
    if (this.config.authMethod === 'SASL/GSSAPI') {
      config['sasl.mechanisms'] = 'GSSAPI'
      config['sasl.kerberos.service.name'] = this.config.serviceName || 'kafka'

      if (this.config.kerberosPrincipal) {
        config['sasl.kerberos.principal'] = this.config.kerberosPrincipal
      }

      if (this.config.kerberosKeytab) {
        console.log(`[RdKafka] Processing keytab, length: ${this.config.kerberosKeytab.length}`)
        console.log(`[RdKafka] Keytab starts with: ${this.config.kerberosKeytab.substring(0, 50)}...`)

        // Keytab can be a path or base64-encoded content (from file upload)
        if (this.config.kerberosKeytab.startsWith('/')) {
          // It's a file path, use directly
          config['sasl.kerberos.keytab'] = this.config.kerberosKeytab
          console.log(`[RdKafka] Using keytab file path: ${this.config.kerberosKeytab}`)
        } else if (this.config.kerberosKeytab.startsWith('data:')) {
          // It's a data URL (from FileReader.readAsDataURL)
          // Extract base64 content from data URL: "data:application/octet-stream;base64,<content>"
          const base64Content = this.config.kerberosKeytab.split(',')[1]
          console.log(`[RdKafka] Extracted base64 content, length: ${base64Content.length}`)
          const keytabPath = this.writeTempFile(base64Content, `keytab-${Date.now()}.keytab`, true)
          config['sasl.kerberos.keytab'] = keytabPath
          console.log(`[RdKafka] Created keytab file: ${keytabPath}`)
        } else {
          // Assume it's raw base64-encoded content
          console.log(`[RdKafka] Treating as raw base64 content, length: ${this.config.kerberosKeytab.length}`)
          const keytabPath = this.writeTempFile(this.config.kerberosKeytab, `keytab-${Date.now()}.keytab`, true)
          config['sasl.kerberos.keytab'] = keytabPath
          console.log(`[RdKafka] Created keytab file: ${keytabPath}`)
        }
      }

      if (this.config.krb5Config) {
        // Write krb5.conf to temp file if it's content, not a path
        let krb5Path: string
        if (!this.config.krb5Config.startsWith('/')) {
          krb5Path = this.writeTempFile(this.config.krb5Config, 'krb5.conf')
        } else {
          krb5Path = this.config.krb5Config
        }

        // Set environment variable for Node.js process
        process.env.KRB5_CONFIG = krb5Path

        // CRITICAL: Also copy to /etc/krb5.conf so kinit spawned by librdkafka can find it
        // librdkafka spawns kinit as a child process, which doesn't inherit process.env
        try {
          fs.copyFileSync(krb5Path, '/etc/krb5.conf')
        } catch (error) {
          console.error('[RdKafka] Warning: Could not copy krb5.conf to /etc/krb5.conf:', error)
          // Continue anyway, maybe KRB5_CONFIG will work
        }
      }

      if (this.config.useTicketCache) {
        config['sasl.kerberos.kinit.cmd'] = 'kinit -R'
        if (this.config.ticketCachePath) {
          process.env.KRB5CCNAME = this.config.ticketCachePath
        }
      } else if (config['sasl.kerberos.keytab'] && this.config.kerberosPrincipal) {
        // When using keytab (not ticket cache), we need to tell librdkafka how to run kinit
        // Format: kinit -t <keytab> -k <principal>
        const keytabPath = config['sasl.kerberos.keytab']
        const principal = this.config.kerberosPrincipal
        config['sasl.kerberos.kinit.cmd'] = `kinit -t "${keytabPath}" -k ${principal}`
        console.log(`[RdKafka] Configured kinit command: kinit -t ${keytabPath} -k ${principal}`)
      }
    }

    // Configure SSL/TLS
    if (config['security.protocol'].includes('ssl')) {
      // Enable SSL certificate verification with provided CA certificate
      config['enable.ssl.certificate.verification'] = true
      config['ssl.endpoint.identification.algorithm'] = 'none'

      // Simplified SSL settings for self-signed certificates
      // Remove advanced cipher/curve settings that might cause issues

      // Provide CA certificate for SSL handshake
      if (this.config.certificate) {
        const certPath = this.writeTempFile(this.config.certificate, `ca-cert-${Date.now()}.pem`)
        config['ssl.ca.location'] = certPath
        console.log(`[RdKafka] CA certificate provided: ${certPath}`)
      }

      if (this.config.clientCert) {
        const certPath = this.writeTempFile(this.config.clientCert, `client-cert-${Date.now()}.pem`)
        config['ssl.certificate.location'] = certPath
      }

      if (this.config.clientKey) {
        const keyPath = this.writeTempFile(this.config.clientKey, `client-key-${Date.now()}.pem`)
        config['ssl.key.location'] = keyPath
      }
    }

    return config
  }

  /**
   * Write content to a temporary file and track it for cleanup
   */
  private writeTempFile(content: string, filename: string, isBinary: boolean = false): string {
    const tmpDir = os.tmpdir()
    const tmpFile = path.join(tmpDir, filename)

    if (isBinary) {
      // For binary files, content is already base64-encoded from the data URL
      // We need to decode it to get the actual binary data
      const buffer = Buffer.from(content, 'base64')
      fs.writeFileSync(tmpFile, buffer, { mode: 0o600 })
      console.log(`[RdKafka] Written binary file: ${tmpFile} (${buffer.length} bytes)`)
    } else {
      fs.writeFileSync(tmpFile, content, { mode: 0o600 })
      console.log(`[RdKafka] Written text file: ${tmpFile}`)
    }

    this.tempCertFiles.push(tmpFile)
    return tmpFile
  }

  /**
   * Clean up temporary files
   */
  private cleanup(): void {
    this.tempCertFiles.forEach((file) => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file)
        }
      } catch (error) {
        console.error(`[RdKafka] Failed to delete temp file ${file}:`, error)
      }
    })

    this.tempCertFiles = []
    this.isConnected = false
  }
}
