import TitleCardWithIcon from '../TitleCardWithIcon'
import { StepKeys } from '@/src/config/constants'
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
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="text-center">
        <span className="text-lg font-bold">Resources</span>
      </div>
      <TitleCardWithIcon
        title="Pipeline Resources"
        onClick={() => onStepClick(StepKeys.PIPELINE_RESOURCES)}
        disabled={disabled}
        selected={selected}
      >
        <Image src={SlidersIcon} alt="Pipeline Resources" className="w-8 h-8" width={32} height={32} />
      </TitleCardWithIcon>
    </div>
  )
}
