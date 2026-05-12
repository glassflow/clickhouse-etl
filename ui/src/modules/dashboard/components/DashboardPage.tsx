'use client'

import { useState } from 'react'
import type { DashboardState } from '../types'
import { DashHeader } from './DashHeader'
import { KpiStrip } from './KpiStrip'
import { HealthyBanner } from './HealthyBanner'
import { AttentionQueue } from './AttentionQueue'
import { ThroughputChart } from './ThroughputChart'
import { ActivityFeed } from './ActivityFeed'
import { PipelineTable } from './PipelineTable'
import { DashFirstRun } from './DashFirstRun'

type Props = { state: DashboardState }

export function DashboardPage({ state }: Props) {
  const [env, setEnv] = useState('production')
  const [range, setRange] = useState('last 1h')

  return (
    <div className="min-h-full flex flex-col text-[var(--color-foreground-neutral)] bg-[var(--dash-page-bg)]">
      <DashHeader state={state} env={env} range={range} onEnvChange={setEnv} onRangeChange={setRange} />

      {state.kind === 'first-run' && <DashFirstRun />}

      {state.kind === 'healthy' && (
        <>
          <HealthyBanner lastIncident="4d 12h ago" />
          <KpiStrip stats={state.stats} />
          <div className="grid grid-cols-2 gap-[18px] px-10 pt-6 animate-section-enter" style={{ animationDelay: '60ms' }}>
            <ThroughputChart stats={state.stats} isIncidentState={false} />
            <ActivityFeed items={state.activity} />
          </div>
          <PipelineTable pipelines={state.pipelines} />
        </>
      )}

      {(state.kind === 'populated' || state.kind === 'incident') && (
        <>
          <KpiStrip stats={state.stats} />
          <div className="grid grid-cols-[1.4fr_1fr] gap-[18px] px-10 pt-6 animate-section-enter" style={{ animationDelay: '60ms' }}>
            <AttentionQueue incidents={state.incidents} isIncidentState={state.kind === 'incident'} />
            <div className="flex flex-col gap-[18px]">
              <ThroughputChart stats={state.stats} isIncidentState={state.kind === 'incident'} />
              <ActivityFeed items={state.activity} showViewLog={state.kind !== 'incident'} />
            </div>
          </div>
          <PipelineTable pipelines={state.pipelines} />
        </>
      )}
    </div>
  )
}
