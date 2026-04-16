import TitleCardWithIcon from '../TitleCardWithIcon'
import { useStore } from '@/src/store'
import { getOtlpSignalLabel } from '@/src/config/source-types'

export function OtlpSourceSection({
  disabled,
  selected,
}: {
  disabled: boolean
  selected: boolean
}) {
  const { otlpStore } = useStore()
  const signalLabel = getOtlpSignalLabel(otlpStore.signalType || '')

  return (
    <div className="flex flex-col gap-4 w-1/5">
      <div className="text-center">
        <span className="text-lg font-bold">Source</span>
      </div>
      <TitleCardWithIcon
        title={signalLabel ? `OTLP · ${signalLabel}` : 'OTLP'}
        disabled={disabled}
        selected={selected}
      >
        {/* OpenTelemetry activity/signal icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--color-foreground-neutral-faded)]"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </TitleCardWithIcon>
    </div>
  )
}
