import { ValidationState } from '@/src/types/validation'
import TitleCardWithIcon from '../TitleCardWithIcon'
import { useStore } from '@/src/store'
import { StepKeys } from '@/src/config/constants'
import Image from 'next/image'
import KafkaIcon from '@/src/images/kafka.svg'

export function KafkaConnectionSection({
  disabled,
  selected,
  onStepClick,
}: {
  disabled: boolean
  selected: boolean
  onStepClick: (step: StepKeys) => void
}) {
  const kafkaValidation = useStore((state) => state.kafkaStore.validation)

  return (
    <div className="flex flex-col gap-4 w-1/5">
      <div className="text-center">
        <span className="text-lg font-bold">Source</span>
      </div>
      <TitleCardWithIcon
        validation={kafkaValidation}
        title="Kafka"
        onClick={() => onStepClick(StepKeys.KAFKA_CONNECTION)}
        disabled={disabled}
        selected={selected}
      >
        <Image src={KafkaIcon} alt="Kafka" className="w-8 h-8" width={32} height={32} />
      </TitleCardWithIcon>
    </div>
  )
}
