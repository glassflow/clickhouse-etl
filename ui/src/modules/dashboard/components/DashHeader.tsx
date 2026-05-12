'use client'

import { cn } from '@/src/utils/common.client'
import type { DashboardState } from '../types'

type Props = {
  state: DashboardState
  env: string
  range: string
  onEnvChange: (v: string) => void
  onRangeChange: (v: string) => void
}

function subtitleText(state: DashboardState): { text: string; mod: string } {
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

const PILL = 'inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--dash-subdued-bg)] border border-[var(--color-gray-dark-800)] rounded-[6px] text-[12px] text-[var(--color-foreground-neutral)] cursor-pointer whitespace-nowrap font-[inherit] no-underline focus-ring'
const PILL_LABEL = 'font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-gray-dark-500)]'

export function DashHeader({ state, env, range, onEnvChange, onRangeChange }: Props) {
  const isFirstRun = state.kind === 'first-run'
  const isIncident = state.kind === 'incident'
  const title = isIncident
    ? 'Several pipelines need attention'
    : isFirstRun
      ? 'Welcome to GlassFlow'
      : 'Dashboard'
  const sub = subtitleText(state)

  return (
    <div className="flex items-center justify-between px-10 pt-7 pb-6 border-b border-[var(--color-gray-dark-800)] shrink-0">
      <div className="flex flex-col gap-1">
        <h1 className={cn('title-3 font-semibold m-0', isIncident && 'text-[var(--color-red-500)] !font-bold')}>
          {title}
        </h1>
        <p className={cn(
          'text-[12.5px] m-0 text-[var(--color-gray-dark-500)]',
          sub.mod === 'ok' && 'text-[var(--color-green-500)]',
          sub.mod === 'crit' && 'text-[var(--color-red-500)]',
        )}>
          {sub.text}
        </p>
      </div>

      <div className="flex items-center gap-[10px] shrink-0">
        {isFirstRun ? (
          <>
            <button className={PILL} type="button">Documentation</button>
            <button className={PILL} type="button">Watch demo · 3min</button>
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
        )}
      </div>
    </div>
  )
}
