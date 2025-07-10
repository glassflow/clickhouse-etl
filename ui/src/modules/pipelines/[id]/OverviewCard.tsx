import { Card } from '@/src/components/ui/card'
import HealthIcon from '@/src/images/health.svg'
import MetricsIcon from '@/src/images/metrics.svg'
import Image from 'next/image'

const iconsMapping = {
  health: HealthIcon,
  metrics: MetricsIcon,
}

const defaultMetrics = {
  eventReceivedTime: '2 min. ago',
  totalEvents: '1,546.899',
  totalDeduplication: '1,546.899',
  totalJoins: '1,546.899',
  totalJoinDeduplications: '1,546.899',
  totalIngestOnly: '1,546.899',
}

const HealthSection = () => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2" />
        <span className="text-md font-bold">Kafka</span>
      </div>
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2" />
        <span className="text-md font-bold">ClickHouse</span>
      </div>
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2" />
        <span className="text-md font-bold">Pipeline Engine</span>
      </div>
    </div>
  )
}

const MetricsSection = ({
  eventReceivedTime,
  totalEvents,
  totalDeduplication,
  totalJoins,
  totalJoinDeduplications,
  totalIngestOnly,
}: {
  eventReceivedTime: number
  totalEvents: number
  totalDeduplication: number
  totalJoins: number
  totalJoinDeduplications: number
  totalIngestOnly: number
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2 items-center" />
        <span className="text-md font-bold">
          {eventReceivedTime ? eventReceivedTime : defaultMetrics.eventReceivedTime}
        </span>
        <span className="text-sm font-normal">Last event received</span>
      </div>
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2 items-center" />
        <span className="text-md font-bold">{totalEvents ? totalEvents : defaultMetrics.totalEvents}</span>
        <span className="text-sm font-normal">Total events processed</span>
      </div>
      <div className="flex flex-row gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 mt-2" />
        <span className="text-md font-bold">
          {totalDeduplication ? totalDeduplication : defaultMetrics.totalDeduplication}
        </span>
        <span className="text-sm font-normal">Total deduplication</span>
      </div>
    </div>
  )
}

function OverviewCard({ title, value, type }: { title: string; value: string; type: 'health' | 'metrics' }) {
  return (
    <Card className="border-[var(--color-border-neutral)] rounded-md py-2 px-6 mb-4 w-1/2">
      <div className="flex flex-col gap-4">
        <div className="flex flex-row gap-2">
          <Image src={iconsMapping[type]} alt={type} className="w-6 h-6" width={24} height={24} />
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        {type === 'health' ? <HealthSection /> : <MetricsSection />}
      </div>
    </Card>
  )
}

export default OverviewCard
