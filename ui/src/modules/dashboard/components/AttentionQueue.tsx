'use client'

import { AlertTriangleIcon, XCircleIcon, InfoIcon } from 'lucide-react'
import type { Incident, IncidentSeverity } from '../types'

function SeverityIcon({ severity }: { severity: IncidentSeverity }) {
  if (severity === 'crit') return <XCircleIcon size={14} aria-hidden="true" />
  if (severity === 'warn') return <AlertTriangleIcon size={14} aria-hidden="true" />
  return <InfoIcon size={14} aria-hidden="true" />
}

type Props = {
  incidents: Incident[]
  isIncidentState: boolean
}

export function AttentionQueue({ incidents, isIncidentState }: Props) {
  const count = incidents.length
  return (
    <div className="dash-card">
      <div className="dash-card-h">
        <div>
          <h3>
            Needs your attention
            <span className="dash-count">{count} {count === 1 ? 'incident' : 'incidents'}</span>
          </h3>
        </div>
        <div>
          {isIncidentState ? (
            <button className="dash-link" type="button">Sort by impact ▾</button>
          ) : (
            <button className="dash-link" type="button">View all</button>
          )}
        </div>
      </div>
      <div className="attn-list">
        {incidents.map((incident) => (
          <div key={incident.id} className={`attn-row ${incident.severity}`}>
            <div className="attn-icon">
              <SeverityIcon severity={incident.severity} />
            </div>
            <div className="attn-body">
              <div className="attn-title">
                <span className="attn-pipe">{incident.pipelineName}</span>
                {incident.title}
              </div>
              <div className="attn-desc">{incident.description}</div>
              <div className="attn-meta">
                {incident.meta.map((m, i) => (
                  <span key={i}>
                    {i > 0 && <span className="attn-meta-sep">·</span>}
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <button className="attn-cta" type="button" aria-label={incident.ctaLabel}>
              {incident.ctaLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
