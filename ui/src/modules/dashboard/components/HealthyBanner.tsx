import { CheckIcon } from 'lucide-react'

type Props = { lastIncident: string }

export function HealthyBanner({ lastIncident }: Props) {
  return (
    <div className="mx-10 mt-6 px-5 py-[14px] bg-[var(--color-green-750)] border border-[var(--color-green-alpha-20)] rounded-[8px] flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-[8px] bg-[var(--color-green-750)] text-[var(--color-green-500)] grid place-items-center shrink-0"
        aria-hidden="true"
      >
        <CheckIcon size={18} />
      </div>
      <div className="flex-1">
        <div className="title-6 font-semibold text-[var(--color-foreground-neutral)] mb-0.5">
          All pipelines healthy
        </div>
        <div className="text-[12px] text-[var(--color-gray-dark-100)] leading-relaxed">
          No incidents in the last 24 hours · No schema drift · DLQ stable at 0.02% of throughput
        </div>
      </div>
      <div className="font-mono text-[11px] text-[var(--color-gray-dark-500)] shrink-0">
        last incident · {lastIncident}
      </div>
    </div>
  )
}
