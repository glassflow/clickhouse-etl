'use client'

import React from 'react'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { cn } from '@/src/utils/common.client'
import type { PipelineIntentModel } from '@/src/modules/ai/types'

interface AiIntentSummaryProps {
  intent: PipelineIntentModel | null
  className?: string
  kafkaPassword?: string
  clickhousePassword?: string
  onKafkaPasswordChange?: (pwd: string) => void
  onClickhousePasswordChange?: (pwd: string) => void
  onTestConnections?: () => void
  isTestingConnections?: boolean
}

export function AiIntentSummary({
  intent,
  className,
  kafkaPassword,
  clickhousePassword,
  onKafkaPasswordChange,
  onClickhousePasswordChange,
  onTestConnections,
  isTestingConnections,
}: AiIntentSummaryProps) {
  if (!intent) {
    return (
      <div className={cn('p-4 text-sm', className)}>
        <p className="text-xs font-medium uppercase tracking-wide mb-3 text-[var(--text-secondary)]">
          Pipeline Draft
        </p>
        <p className="text-xs text-[var(--text-secondary)] opacity-60">Waiting for your description...</p>
      </div>
    )
  }

  const hasUntestedKafka = intent.kafka?.bootstrapServers && intent.kafka.connectionStatus !== 'valid'
  const hasUntestedClickhouse = intent.clickhouse?.host && intent.clickhouse.connectionStatus !== 'valid'
  const showTestButton = (hasUntestedKafka || hasUntestedClickhouse) && !!onTestConnections

  return (
    <div className={cn('p-4 space-y-4 text-sm overflow-y-auto', className)}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide mb-3 text-[var(--text-secondary)]">
          Pipeline Draft
        </p>
        <ModeIndicator mode={intent.mode} />
      </div>

      {/* Operation type */}
      {intent.operationType && (
        <Section title="Operation">
          <StatusRow
            label={intent.operationType === 'ingest-only' ? 'Ingest Only' : 'Deduplication'}
            status="ok"
          />
        </Section>
      )}

      {/* Kafka source */}
      {intent.kafka && (
        <Section title="Kafka Source">
          {intent.kafka.bootstrapServers && (
            <Row label="Brokers" value={intent.kafka.bootstrapServers} />
          )}
          {intent.kafka.authMethod && (
            <Row label="Auth" value={intent.kafka.authMethod} />
          )}
          <StatusRow
            label="Connection"
            status={
              intent.kafka.connectionStatus === 'valid'
                ? 'ok'
                : intent.kafka.connectionStatus === 'invalid'
                  ? 'error'
                  : 'pending'
            }
          />
          {intent.kafka.connectionStatus === 'invalid' && intent.kafka.connectionError && (
            <p className="text-[10px] text-[var(--color-foreground-critical)] break-all pl-3.5">
              {intent.kafka.connectionError}
            </p>
          )}
          {intent.kafka.availableTopics && intent.kafka.availableTopics.length > 0 && (
            <Row
              label={`${intent.kafka.availableTopics.length} topics available`}
              value=""
            />
          )}
          {intent.kafka.bootstrapServers && intent.kafka.connectionStatus !== 'valid' && onKafkaPasswordChange && (
            <div className="pt-1 space-y-1">
              <Input
                type="password"
                placeholder="Kafka password (optional)"
                value={kafkaPassword ?? ''}
                onChange={(e) => onKafkaPasswordChange(e.target.value)}
                className="h-7 text-xs"
                autoComplete="off"
              />
              <p className="text-[10px] text-[var(--text-secondary)] opacity-70">
                Used only for connection testing — never sent to AI
              </p>
            </div>
          )}
        </Section>
      )}

      {/* Topics */}
      {intent.topics?.length > 0 && intent.topics[0]?.topicName && (
        <Section title="Topic">
          <Row label="Name" value={intent.topics[0].topicName} />
          {intent.operationType === 'deduplication' && (
            <>
              <StatusRow
                label="Deduplication"
                status={intent.topics[0].deduplicationEnabled ? 'ok' : 'pending'}
              />
              {intent.topics[0].deduplicationKey && (
                <Row label="Key field" value={intent.topics[0].deduplicationKey} />
              )}
              {intent.topics[0].deduplicationWindow && (
                <Row
                  label="Window"
                  value={`${intent.topics[0].deduplicationWindow} ${intent.topics[0].deduplicationWindowUnit || 'hours'}`}
                />
              )}
            </>
          )}
        </Section>
      )}

      {/* ClickHouse destination */}
      {intent.clickhouse && (
        <Section title="ClickHouse Destination">
          {intent.clickhouse.host && (
            <Row label="Host" value={intent.clickhouse.host} />
          )}
          {intent.clickhouse.httpPort && (
            <Row label="HTTP Port" value={String(intent.clickhouse.httpPort)} />
          )}
          {intent.clickhouse.nativePort && (
            <Row label="Native Port" value={String(intent.clickhouse.nativePort)} />
          )}
          {intent.clickhouse.useSSL !== undefined && (
            <Row label="SSL" value={intent.clickhouse.useSSL ? 'enabled' : 'disabled'} />
          )}
          {intent.clickhouse.database && (
            <Row label="Database" value={intent.clickhouse.database} />
          )}
          <StatusRow
            label="Connection"
            status={
              intent.clickhouse.connectionStatus === 'valid'
                ? 'ok'
                : intent.clickhouse.connectionStatus === 'invalid'
                  ? 'error'
                  : 'pending'
            }
          />
          {intent.clickhouse.connectionStatus === 'invalid' && intent.clickhouse.connectionError && (
            <p className="text-[10px] text-[var(--color-foreground-critical)] break-all pl-3.5">
              {intent.clickhouse.connectionError}
            </p>
          )}
          {intent.destination?.tableName && (
            <Row label="Table" value={intent.destination.tableName} />
          )}
          {intent.clickhouse.host && intent.clickhouse.connectionStatus !== 'valid' && onClickhousePasswordChange && (
            <div className="pt-1 space-y-1">
              <Input
                type="password"
                placeholder="ClickHouse password (optional)"
                value={clickhousePassword ?? ''}
                onChange={(e) => onClickhousePasswordChange(e.target.value)}
                className="h-7 text-xs"
                autoComplete="off"
              />
              <p className="text-[10px] text-[var(--text-secondary)] opacity-70">
                Used only for connection testing — never sent to AI
              </p>
            </div>
          )}
        </Section>
      )}

      {/* Test Connections button */}
      {showTestButton && (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={onTestConnections}
          disabled={isTestingConnections}
          loading={isTestingConnections}
          loadingText="Testing..."
        >
          Test Connections
        </Button>
      )}

      {/* Filter */}
      {intent.filter?.expression && (
        <Section title="Filter">
          <code className="text-xs bg-[var(--surface-bg-sunken)] px-2 py-1 rounded block break-all">
            {intent.filter.expression}
          </code>
        </Section>
      )}

      {/* Unresolved questions */}
      {intent.unresolvedQuestions?.length > 0 && (
        <Section title="Still needed">
          <ul className="space-y-1">
            {intent.unresolvedQuestions.map((q, i) => (
              <li key={i} className="text-xs text-[var(--text-secondary)] flex gap-1.5 items-start">
                <span className="text-[var(--color-foreground-warning)] shrink-0 mt-0.5">⚠</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">{title}</p>
      <div className="space-y-1 pl-2 border-l border-[var(--surface-border)]">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return <p className="text-xs text-[var(--text-secondary)]">{label}</p>
  return (
    <div className="flex gap-1.5 items-start text-xs">
      <span className="text-[var(--text-secondary)] shrink-0">{label}:</span>
      <span className="text-[var(--text-primary)] break-all">{value}</span>
    </div>
  )
}

function StatusRow({ label, status }: { label: string; status: 'ok' | 'error' | 'pending' }) {
  const icon = status === 'ok' ? '✓' : status === 'error' ? '✗' : '◌'
  const color =
    status === 'ok'
      ? 'text-[var(--color-foreground-positive)]'
      : status === 'error'
        ? 'text-[var(--color-foreground-critical)]'
        : 'text-[var(--text-secondary)]'

  return (
    <div className="flex gap-1.5 items-center text-xs">
      <span className={cn('shrink-0 font-mono', color)}>{icon}</span>
      <span className="text-[var(--text-primary)]">{label}</span>
    </div>
  )
}

function ModeIndicator({ mode }: { mode: PipelineIntentModel['mode'] }) {
  const labels: Record<PipelineIntentModel['mode'], string> = {
    collecting: 'Collecting info',
    enriching: 'Verifying connections',
    ready_for_review: 'Ready to review',
    ready_for_materialization: 'Ready to generate',
  }
  const variants: Record<PipelineIntentModel['mode'], 'secondary' | 'outline' | 'default'> = {
    collecting: 'secondary',
    enriching: 'secondary',
    ready_for_review: 'outline',
    ready_for_materialization: 'default',
  }

  return (
    <Badge variant={variants[mode]} className="text-xs">
      {labels[mode]}
    </Badge>
  )
}
