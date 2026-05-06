import { CheckIcon } from 'lucide-react'

type Props = { lastIncident: string }

export function HealthyBanner({ lastIncident }: Props) {
  return (
    <div className="healthy-banner">
      <div className="hb-icon" aria-hidden="true">
        <CheckIcon size={18} />
      </div>
      <div className="hb-body">
        <div className="hb-title">All pipelines healthy</div>
        <div className="hb-desc">
          No incidents in the last 24 hours · No schema drift · DLQ stable at 0.02% of throughput
        </div>
      </div>
      <div className="hb-meta">last incident · {lastIncident}</div>
    </div>
  )
}
