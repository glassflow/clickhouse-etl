import { Card } from '@/src/components/ui/card'
import { StepKeys } from '@/src/config/constants'
import { useStore } from '@/src/store'
import { cn } from '@/src/utils/common.client'
import Image from 'next/image'
import SlidersIcon from '@/src/images/sliders.svg'

export function PipelineResourcesSection({
  disabled,
  selected,
  onStepClick,
}: {
  disabled: boolean
  selected: boolean
  onStepClick: (step: StepKeys) => void
}) {
  const resources = useStore((state) => state.resourcesStore.pipeline_resources)
  const replicas = resources?.ingestor?.base?.replicas
  const cpu = resources?.ingestor?.base?.requests?.cpu
  const memory = resources?.ingestor?.base?.requests?.memory
  const hasValues = replicas != null || cpu || memory

  return (
    <Card
      className={cn(
        'card-outline px-4 py-3',
        !disabled && 'cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        selected && 'card-outline-selected',
      )}
      onClick={disabled ? undefined : () => onStepClick(StepKeys.PIPELINE_RESOURCES)}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Image src={SlidersIcon} alt="" className="w-4 h-4 opacity-60" width={16} height={16} />
          <span className="body-3 font-medium text-[var(--color-foreground-neutral-faded)]">Pipeline Resources</span>
        </div>
        <div className="flex items-center gap-4 caption-1 text-muted-foreground">
          {hasValues ? (
            <>
              {replicas != null && <span>{replicas} {replicas === 1 ? 'replica' : 'replicas'}</span>}
              {cpu && <span>CPU {cpu}</span>}
              {memory && <span>Mem {memory}</span>}
            </>
          ) : (
            <span className="opacity-50">Default resources</span>
          )}
        </div>
      </div>
    </Card>
  )
}
