import { Card } from '@/src/components/ui/card'
import HealthIcon from '@/src/images/health.svg'
import Image from 'next/image'

const greenDot = () => <div className="w-3 h-3 rounded-full bg-green-500 mt-2" />
const redDot = () => <div className="w-3 h-3 rounded-full bg-red-500 mt-2" />
const yellowDot = () => <div className="w-3 h-3 rounded-full bg-yellow-500 mt-2" />
const blueDot = () => <div className="w-3 h-3 rounded-full bg-blue-500 mt-2" />

const StatusMapping = {
  stable: greenDot,
  failed: redDot,
  unstable: yellowDot,
  info: blueDot,
}

const statusLabels = {
  stable: 'Stable',
  failed: 'Failed',
  unstable: 'Unstable',
  info: 'Info',
}

function PipelineHealthCard({ status, label }: { status: 'stable' | 'failed' | 'unstable' | 'info'; label?: string }) {
  const StatusIcon = StatusMapping[status]

  return (
    <Card className="border-[var(--color-border-neutral)] radius-large py-2 px-6 mb-4 w-1/3">
      <div className="flex flex-col gap-4">
        <div className="flex flex-row gap-2">
          <Image src={HealthIcon} alt="Health" className="w-6 h-6" width={24} height={24} />
          <h3 className="text-lg font-bold">Pipeline Health</h3>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-2">
            <StatusIcon />
            <span className="text-md font-bold text-[var(--color-foreground-neutral-faded)]">
              {label || statusLabels[status]}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default PipelineHealthCard
