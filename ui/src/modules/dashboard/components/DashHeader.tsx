'use client'

import { cn } from '@/src/utils/common.client'
import { PageShell } from '@/src/components/shared/page-shell'
import type { DashboardState } from '../types'

type Props = {
  state: DashboardState
  env: string
  range: string
  onEnvChange: (v: string) => void
  onRangeChange: (v: string) => void
  children?: React.ReactNode
}

function subtitleText(state: DashboardState): { text: string; mod: '' | 'ok' | 'crit' } {
  switch (state.kind) {
    case 'first-run':
      return {
        text: 'Stream Kafka, OTLP, or anything else into ClickHouse — without writing a consumer.',
        mod: '',
      }
    case 'healthy':
      return {
        text: `Everything's running smoothly · ${state.pipelines.length} pipelines active`,
        mod: 'ok',
      }
    case 'populated': {
      const n = state.incidents.length
      return {
        text: `${n} ${n === 1 ? 'thing' : 'things'} need your attention · ${state.stats.activePipelines} pipelines active`,
        mod: '',
      }
    }
    case 'incident': {
      const crit = state.incidents.filter((i) => i.severity === 'crit').length
      const warn = state.incidents.filter((i) => i.severity === 'warn').length
      const deploying = state.pipelines.filter((p) => p.statusLabel.includes('validating')).length
      const parts = [
        crit > 0 && `${crit} critical`,
        warn > 0 && `${warn} warnings`,
        deploying > 0 && `${deploying} deploy in progress`,
      ].filter(Boolean)
      return { text: parts.join(' · '), mod: 'crit' }
    }
  }
}

const PILL =
  'inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--dash-subdued-bg)] border border-[var(--color-gray-dark-800)] rounded-[6px] text-[12px] text-[var(--color-foreground-neutral)] cursor-pointer whitespace-nowrap font-[inherit] no-underline focus-ring'
const PILL_LABEL = 'font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-gray-dark-500)]'

/**
 * Dashboard top-bar — state-driven title/subtitle/actions, rendered via
 * <PageShell> so layout/typography stays consistent with Library and Pipelines.
 * Children are the dashboard sections (KPI, charts, table) rendered inside
 * the PageShell body.
 */
export function DashHeader({ state, env, range, onEnvChange, onRangeChange, children }: Props) {
  const isFirstRun = state.kind === 'first-run'
  const isIncident = state.kind === 'incident'
  const title = isIncident ? 'Several pipelines need attention' : isFirstRun ? 'Welcome to GlassFlow' : 'Dashboard'
  const sub = subtitleText(state)

  const titleNode = <span className={cn(isIncident && 'text-[var(--color-red-500)] !font-bold')}>{title}</span>

  const subtitleNode = (
    <span
      className={cn(
        sub.mod === 'ok' && 'text-[var(--color-green-500)]',
        sub.mod === 'crit' && 'text-[var(--color-red-500)]',
      )}
    >
      {sub.text}
    </span>
  )

  const actions = isFirstRun ? (
    <>
      <button className={PILL} type="button">
        Documentation
      </button>
      <button className={PILL} type="button">
        Watch demo · 3min
      </button>
    </>
  ) : (
    <>
      <button className={PILL} type="button" onClick={() => onEnvChange(env)}>
        <span className={PILL_LABEL}>env</span>
        <span>{env}</span>
      </button>
      <button className={PILL} type="button" onClick={() => onRangeChange(range)}>
        <span className={PILL_LABEL}>range</span>
        <span>{range}</span>
      </button>
      <a
        href="/"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[12px] font-semibold text-black cursor-pointer whitespace-nowrap no-underline focus-ring"
        style={{
          background: 'linear-gradient(180deg, var(--color-orange-200) 0%, var(--color-orange-500) 100%)',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'var(--color-orange-400)',
        }}
      >
        + New pipeline
      </a>
    </>
  )

  return (
    <PageShell title={titleNode} subtitle={subtitleNode} actions={actions}>
      {children}
    </PageShell>
  )
}
