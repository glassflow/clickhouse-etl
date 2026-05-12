'use client'

import { AlertTriangleIcon, XCircleIcon, InfoIcon } from 'lucide-react'
import { cn } from '@/src/utils/common.client'
import type { Incident, IncidentSeverity } from '../types'

function SeverityIcon({ severity }: { severity: IncidentSeverity }) {
  if (severity === 'crit') return <XCircleIcon size={14} aria-hidden="true" />
  if (severity === 'warn') return <AlertTriangleIcon size={14} aria-hidden="true" />
  return <InfoIcon size={14} aria-hidden="true" />
}

const ICON_CLS: Record<IncidentSeverity, string> = {
  crit: 'bg-[var(--color-red-750)] text-[var(--color-red-500)]',
  warn: 'bg-[var(--color-yellow-alpha-8)] text-[var(--color-yellow-400)]',
  info: 'bg-[var(--color-blue-750)] text-[var(--color-blue-500)]',
}

const CARD_H = 'flex items-center justify-between px-[18px] py-[14px] border-b border-[var(--color-gray-dark-800)]'
const CARD = 'bg-[var(--dash-card-bg)] border border-[var(--color-gray-dark-700)] rounded-[10px] flex flex-col overflow-hidden'
const LINK_BTN = 'text-[11.5px] text-[var(--color-gray-dark-100)] font-mono cursor-pointer bg-transparent border-0 p-0 hover:text-[var(--color-orange-300)] transition-colors duration-[120ms] focus-ring'

type Props = {
  incidents: Incident[]
  isIncidentState: boolean
}

export function AttentionQueue({ incidents, isIncidentState }: Props) {
  const count = incidents.length
  return (
    <div className={CARD}>
      <div className={CARD_H}>
        <div>
          <h3 className="title-6 font-semibold m-0 tracking-[-0.005em] text-[var(--color-foreground-neutral)] flex items-center gap-0">
            Needs your attention
            <span className="font-mono text-[10.5px] text-[var(--color-gray-dark-500)] ml-2 font-normal tracking-normal">
              {count} {count === 1 ? 'incident' : 'incidents'}
            </span>
          </h3>
        </div>
        <div>
          {isIncidentState ? (
            <button className={LINK_BTN} type="button">Sort by impact ▾</button>
          ) : (
            <button className={LINK_BTN} type="button">View all</button>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        {incidents.map((incident) => (
          <div
            key={incident.id}
            data-severity={incident.severity}
            className={cn(
              'grid gap-[14px] items-start px-[18px] py-[14px] border-b border-[var(--color-gray-dark-800)] last:border-b-0 cursor-pointer transition-colors duration-[120ms]',
              'grid-cols-[28px_1fr_auto]',
              incident.severity === 'crit'
                ? 'bg-[rgba(226,44,44,0.05)] hover:bg-[rgba(226,44,44,0.07)]'
                : 'hover:bg-[var(--dash-row-hover)]',
            )}
          >
            <div className={cn('w-7 h-7 rounded-[6px] grid place-items-center shrink-0', ICON_CLS[incident.severity])}>
              <SeverityIcon severity={incident.severity} />
            </div>

            <div>
              <div className="title-6 font-semibold text-[var(--color-foreground-neutral)] mb-0.5 tracking-[-0.005em]">
                <span className="font-mono font-medium text-[11.5px] text-[var(--color-orange-300)] bg-[var(--color-orange-alpha-10)] px-1.5 py-px rounded-[3px] mr-1.5">
                  {incident.pipelineName}
                </span>
                {incident.title}
              </div>
              <div className="text-[12px] leading-relaxed text-[var(--color-gray-dark-100)] mb-2">
                {incident.description}
              </div>
              <div className="flex gap-[14px] text-[10.5px] font-mono text-[var(--color-gray-dark-500)]">
                {incident.meta.map((m, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-[var(--color-gray-dark-700)]">·</span>}
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <button
              className={cn(
                'flex items-center gap-1.5 px-[10px] py-[6px] rounded-[5px] text-[11px] whitespace-nowrap cursor-pointer transition-all duration-[120ms] border focus-ring',
                incident.severity === 'crit'
                  ? 'bg-[var(--color-red-750)] border-[var(--color-red-alpha-40)] text-[var(--color-red-500)]'
                  : 'bg-[var(--dash-element-bg)] border-[var(--color-gray-dark-700)] text-[var(--color-gray-100)] hover:bg-[var(--color-orange-alpha-10)] hover:border-[var(--color-orange-300)] hover:text-[var(--color-orange-300)]',
              )}
              type="button"
              aria-label={incident.ctaLabel}
            >
              {incident.ctaLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
