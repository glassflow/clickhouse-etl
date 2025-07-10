import PipelineDetailsHeader from './PipelineDetailsHeader'
import OverviewCard from './OverviewCard'
import ConfigDetailSimple from './ConfigDetailSimple'
import ConfigDetailTwoColumn from './ConfigDetailTwoColumn'
import ConfigDetailIcon from './ConfigDetailIcon'
import OverviewSection from './OverviewSection'

function PipelineDetailsModule({ pipeline }: { pipeline: any }) {
  return (
    <div>
      <div className="flex flex-col gap-4">
        <PipelineDetailsHeader title={pipeline.name} status={pipeline.status} actions={pipeline.actions} />
      </div>
      <div className="flex flex-col gap-4">
        <OverviewSection />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          {/* Source - Transform - Sink */}
          <ConfigDetailIcon />
          <ConfigDetailSimple />
          <ConfigDetailIcon />
        </div>
        <div className="flex flex-col gap-4">
          {/* Maping details */}
          <ConfigDetailIcon />
          <ConfigDetailSimple />
          <ConfigDetailIcon />
        </div>
      </div>
    </div>
  )
}

export default PipelineDetailsModule
