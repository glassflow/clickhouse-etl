import PipelineDetailsHeader from './PipelineDetailsHeader'
import OverviewCard from './DeadLetterQueueCard'
import TitleCardWithIcon from './TitleCardWithIcon'
import PipelineStatusOverviewSection from './PipelineStatusOverviewSection'
import TransformationSection from './TransformationSection'
import KafkaIcon from '@/src/images/kafka.svg'
import ClickHouseIcon from '@/src/images/clickhouse.svg'
import Image from 'next/image'

function PipelineDetailsModule({ pipeline }: { pipeline: any }) {
  return (
    <div>
      <div className="flex flex-col gap-4">
        <PipelineDetailsHeader title={pipeline.name} status={pipeline.status} actions={pipeline.actions} />
      </div>
      <div className="flex flex-col gap-4">
        <PipelineStatusOverviewSection />
      </div>
      <div className="flex flex-row gap-4">
        <div className="flex flex-col gap-4 w-1/3">
          {/* Source */}
          <div className="text-center">
            <span className="text-lg font-bold">Source</span>
          </div>
          <TitleCardWithIcon title="Kafka">
            <Image src={KafkaIcon} alt="Kafka" className="w-8 h-8" width={32} height={32} />
          </TitleCardWithIcon>
        </div>
        <div className="flex flex-col gap-4 w-1/3">
          {/* Transformation */}
          <div className="text-center">
            <span className="text-lg font-bold">Transformation: {pipeline.transformationName || 'Default'}</span>
          </div>
          <TransformationSection pipeline={pipeline} />
        </div>
        <div className="flex flex-col gap-4 w-1/3">
          {/* Sink */}
          <div className="text-center">
            <span className="text-lg font-bold">Sink</span>
          </div>
          <TitleCardWithIcon title="ClickHouse">
            <Image src={ClickHouseIcon} alt="ClickHouse" className="w-8 h-8" width={32} height={32} />
          </TitleCardWithIcon>
        </div>
      </div>
    </div>
  )
}

export default PipelineDetailsModule
