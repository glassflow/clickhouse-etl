'use client'

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
    <div className="dash-header">
      <div className="dash-header-l">
        <h1 className={`dash-title${isIncident ? ' crit' : ''}`}>{title}</h1>
        <p className={`dash-subtitle${sub.mod ? ` ${sub.mod}` : ''}`}>{sub.text}</p>
      </div>
      <div className="dash-header-r">
        {isFirstRun ? (
          <>
            <button className="dash-pill" type="button">Documentation</button>
            <button className="dash-pill" type="button">Watch demo · 3min</button>
          </>
        ) : (
          <>
            <button className="dash-pill" type="button" onClick={() => onEnvChange(env)}>
              <span className="label">env</span>
              <span className="val">{env}</span>
            </button>
            <button className="dash-pill" type="button" onClick={() => onRangeChange(range)}>
              <span className="label">range</span>
              <span className="val">{range}</span>
            </button>
            <a href="/" className="dash-pill is-primary">+ New pipeline</a>
          </>
        )}
      </div>
    </div>
  )
}
