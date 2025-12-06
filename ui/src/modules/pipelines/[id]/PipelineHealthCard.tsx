import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import Image from 'next/image'
import HealthIcon from '@/src/images/health.svg'
import { PipelineHealth, PipelineHealthStatus } from '@/src/api/pipeline-health'
import { getHealthStatusDisplayText, getHealthStatusClasses } from '@/src/api/pipeline-health'

interface PipelineHealthCardProps {
  health: PipelineHealth | null
  isLoading?: boolean
  error?: string | null
}

function PipelineHealthCard({ health, isLoading, error }: PipelineHealthCardProps) {
  // Determine status and styling based on health data
  const getStatusInfo = () => {
    if (isLoading) {
      return {
        status: 'info' as const,
        label: 'Checking...',
        classes: 'text-blue-600 bg-blue-50 border-blue-200',
        dot: <div className="w-3 h-3 rounded-full bg-blue-500 mt-2 animate-pulse" />,
      }
    }

    if (error) {
      return {
        status: 'failed' as const,
        label: 'Error',
        classes: 'text-red-600 bg-red-50 border-red-200',
        dot: <div className="w-3 h-3 rounded-full bg-red-500 mt-2" />,
      }
    }

    if (!health) {
      return {
        status: 'info' as const,
        label: 'No Data',
        classes: 'text-gray-600 bg-gray-50 border-gray-200',
        dot: <div className="w-3 h-3 rounded-full bg-gray-500 mt-2" />,
      }
    }

    // Map backend status to UI status
    const statusMapping: Record<
      PipelineHealthStatus,
      { status: 'stable' | 'failed' | 'unstable' | 'info'; classes: string }
    > = {
      Created: { status: 'info', classes: 'text-blue-600 bg-blue-50 border-blue-200' },
      Running: { status: 'stable', classes: 'text-green-600 bg-green-50 border-green-200' },
      Paused: { status: 'unstable', classes: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
      Pausing: { status: 'unstable', classes: 'text-orange-600 bg-orange-50 border-orange-200' },
      Resuming: { status: 'unstable', classes: 'text-orange-600 bg-orange-50 border-orange-200' },
      Stopping: { status: 'unstable', classes: 'text-orange-600 bg-orange-50 border-orange-200' },
      Stopped: { status: 'info', classes: 'text-gray-600 bg-gray-50 border-gray-200' },
      Terminating: { status: 'unstable', classes: 'text-orange-600 bg-orange-50 border-orange-200' },
      Terminated: { status: 'info', classes: 'text-gray-600 bg-gray-50 border-gray-200' },
      Failed: { status: 'failed', classes: 'text-red-600 bg-red-50 border-red-200' },
    }

    const mappedStatus = statusMapping[health.overall_status]
    return {
      status: mappedStatus.status,
      label: getHealthStatusDisplayText(health.overall_status),
      classes: mappedStatus.classes,
      dot: (
        <div
          className={`w-3 h-3 rounded-full mt-2 ${mappedStatus.status === 'stable' ? 'bg-green-500' : mappedStatus.status === 'failed' ? 'bg-red-500' : mappedStatus.status === 'unstable' ? 'bg-orange-500' : 'bg-blue-500'}`}
        />
      ),
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <Card className="card-outline py-2 px-6 mb-4 w-1/3">
      <div className="flex flex-col gap-4">
        <div className="flex flex-row gap-2">
          <Image src={HealthIcon} alt="Health" className="w-6 h-6" width={24} height={24} />
          <h3 className="text-lg font-bold">Pipeline Health</h3>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-2">
            {statusInfo.dot}
            <span className="text-md font-bold text-[var(--color-foreground-neutral-faded)]">{statusInfo.label}</span>
          </div>
          {health && (
            <div className="text-sm text-gray-600">
              <div>Status: {health.overall_status}</div>
              <div>Updated: {new Date(health.updated_at).toLocaleString()}</div>
            </div>
          )}
          {error && <div className="text-sm text-red-600">Error: {error}</div>}
        </div>
      </div>
    </Card>
  )
}

export default PipelineHealthCard
