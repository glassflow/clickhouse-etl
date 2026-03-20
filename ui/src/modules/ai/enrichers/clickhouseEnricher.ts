import { ClickhouseService } from '@/src/services/clickhouse-service'
import { structuredLogger } from '@/src/observability'
import type { ClickhouseConnectionIntent } from '@/src/modules/ai/types'

export interface ClickhouseEnrichmentResult {
  connectionStatus: 'unknown' | 'valid' | 'invalid'
  availableTables?: string[]
  availableDatabases?: string[]
  error?: string
}

/**
 * Tests ClickHouse connectivity from a ClickhouseConnectionIntent.
 * Password is not stored in the intent; caller must pass it separately.
 */
export async function enrichClickhouseConnection(
  intent: ClickhouseConnectionIntent,
  password?: string,
): Promise<ClickhouseEnrichmentResult> {
  if (!intent.host) {
    return { connectionStatus: 'unknown' }
  }

  try {
    const clickhouseService = new ClickhouseService()
    const useSSL = intent.useSSL ?? true
    const config = {
      host: intent.host,
      httpPort: intent.httpPort || (useSSL ? 8443 : 8123),
      nativePort: intent.nativePort,
      username: intent.username || 'default',
      password: password || '',
      database: intent.database,
      useSSL,
      connectionType: 'http' as const,
      skipCertificateVerification: intent.skipCertificateVerification ?? false,
    }

    // First test basic connection
    const connResult = await clickhouseService.testConnection({
      config,
      testType: 'connection',
    })

    if (!connResult.success) {
      return { connectionStatus: 'invalid', error: (connResult as any).error }
    }

    const databases = (connResult as any).databases || []

    // If database specified, list tables
    if (intent.database) {
      const dbResult = await clickhouseService.testConnection({
        config,
        testType: 'database',
        database: intent.database,
      })

      if (dbResult.success) {
        return {
          connectionStatus: 'valid',
          availableDatabases: databases,
          availableTables: (dbResult as any).tables || [],
        }
      }
    }

    return { connectionStatus: 'valid', availableDatabases: databases }
  } catch (err) {
    structuredLogger.warn('ClickHouse enrichment failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      connectionStatus: 'invalid',
      error: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}

/**
 * Returns a redacted ClickHouse connection summary safe for LLM prompts.
 */
export function redactClickhouseCredentials(intent: ClickhouseConnectionIntent | null): Record<string, unknown> {
  if (!intent) return {}
  return {
    host: intent.host,
    httpPort: intent.httpPort,
    username: intent.username,
    password: '[REDACTED]',
    database: intent.database,
    connectionStatus: intent.connectionStatus,
    availableTables: intent.availableTables?.slice(0, 30),
  }
}
