import TitleCardWithIcon from '../TitleCardWithIcon'
import { useStore } from '@/src/store'
import { StepKeys } from '@/src/config/constants'
import Image from 'next/image'
import ClickHouseIcon from '@/src/images/clickhouse.svg'

export function ClickhouseConnectionSection({
  disabled,
  selected,
  onStepClick,
}: {
  disabled: boolean
  selected: boolean
  onStepClick: (step: StepKeys) => void
}) {
  const clickhouseConnectionValidation = useStore((state) => state.clickhouseConnectionStore.validation)
  const database = useStore((state) => state.clickhouseDestinationStore.clickhouseDestination.database)
  const table = useStore((state) => state.clickhouseDestinationStore.clickhouseDestination.table)

  const subtitle = database && table ? `${database} / ${table}` : database || table || undefined

  return (
    <div className="flex flex-col gap-4 w-1/5">
      <div className="text-center">
        <span className="text-lg font-bold">Sink</span>
      </div>
      <TitleCardWithIcon
        validation={clickhouseConnectionValidation}
        title="ClickHouse"
        subtitle={subtitle}
        onClick={() => onStepClick(StepKeys.CLICKHOUSE_CONNECTION)}
        disabled={disabled}
        selected={selected}
      >
        <Image src={ClickHouseIcon} alt="ClickHouse" className="w-8 h-8" width={32} height={32} />
      </TitleCardWithIcon>
    </div>
  )
}
