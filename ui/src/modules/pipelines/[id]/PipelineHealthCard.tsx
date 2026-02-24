import { Card } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import Image from 'next/image'
import HealthIcon from '@/src/images/health.svg'
import { PipelineHealth, PipelineHealthStatus } from '@/src/api/pipeline-health'
import { getHealthStatusDisplayText } from '@/src/api/pipeline-health'

interface PipelineHealthCardProps {
  health: PipelineHealth | null
  isLoading?: boolean
  error?: string | null
}

function PipelineHealthCard({ health, isLoading, error }: PipelineHealthCardProps) {
  // Determine status and styling based on health data
  const getStatusInfo = () => {
    const infoClasses =
      'text-[var(--color-foreground-info)] bg-[var(--color-background-info-faded)] border-[var(--color-border-info)]'
    const stableClasses =
      'text-[var(--color-foreground-positive)] bg-[var(--color-background-positive-faded)] border-[var(--color-border-positive)]'
    const unstableClasses =
      'text-[var(--color-foreground-warning)] bg-[var(--color-background-warning-faded)] border-[var(--color-border-warning)]'
    const failedClasses =
      'text-[var(--color-foreground-critical)] bg-[var(--color-background-critical-faded)] border-[var(--color-border-critical)]'
    const neutralClasses =
      'text-[var(--color-foreground-neutral-faded)] bg-[var(--color-background-neutral-faded)] border-[var(--color-border-neutral-faded)]'

    if (isLoading) {
      return {
        status: 'info' as const,
        label: 'Checking...',
        classes: infoClasses,
        dot: <div className="w-3 h-3 rounded-full bg-[var(--color-foreground-info)] mt-2 animate-pulse" />,
      }
    }

    if (error) {
      return {
        status: 'failed' as const,
        label: 'Error',
        classes: failedClasses,
        dot: <div className="w-3 h-3 rounded-full bg-[var(--color-foreground-critical)] mt-2" />,
      }
    }

    if (!health) {
      return {
        status: 'info' as const,
        label: 'No Data',
        classes: neutralClasses,
        dot: <div className="w-3 h-3 rounded-full bg-[var(--color-foreground-disabled)] mt-2" />,
      }
    }

    // Map backend status to UI status
    const statusMapping: Record<
      PipelineHealthStatus,
      { status: 'stable' | 'failed' | 'unstable' | 'info'; classes: string }
    > = {
      Created: { status: 'info', classes: infoClasses },
      Running: { status: 'stable', classes: stableClasses },
      Paused: { status: 'unstable', classes: unstableClasses },
      Pausing: { status: 'unstable', classes: unstableClasses },
      Resuming: { status: 'unstable', classes: unstableClasses },
      Stopping: { status: 'unstable', classes: unstableClasses },
      Stopped: { status: 'info', classes: neutralClasses },
      Terminating: { status: 'unstable', classes: unstableClasses },
      Terminated: { status: 'info', classes: neutralClasses },
      Failed: { status: 'failed', classes: failedClasses },
    }

    const mappedStatus = statusMapping[health.overall_status]
    const dotClass =
      mappedStatus.status === 'stable'
        ? 'bg-[var(--color-foreground-positive)]'
        : mappedStatus.status === 'failed'
          ? 'bg-[var(--color-foreground-critical)]'
          : mappedStatus.status === 'unstable'
            ? 'bg-[var(--color-foreground-warning)]'
            : 'bg-[var(--color-foreground-info)]'
    return {
      status: mappedStatus.status,
      label: getHealthStatusDisplayText(health.overall_status),
      classes: mappedStatus.classes,
      dot: <div className={`w-3 h-3 rounded-full mt-2 ${dotClass}`} />,
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
            <div className="text-sm text-[var(--color-foreground-neutral-faded)]">
              <div>Status: {health.overall_status}</div>
              <div>Updated: {new Date(health.updated_at).toLocaleString()}</div>
            </div>
          )}
          {error && <div className="text-sm text-[var(--color-foreground-critical)]">Error: {error}</div>}
        </div>
      </div>
    </Card>
  )
}

export default PipelineHealthCard
