import React from 'react'
import { useStore } from '@/src/store'
import { useValidationEngine } from '@/src/store/state-machine/validation-engine'
import { StepKeys } from '@/src/config/constants'
import { Button } from '@/src/components/ui/button'

/**
 * Demo component to show how the validation system works
 * This demonstrates the validation engine in action
 */
const ValidationDemo = () => {
  const validationEngine = useValidationEngine()

  // Get all validation states
  const kafkaValidation = useStore((state) => state.kafkaStore.validation)
  const topicsValidation = useStore((state) => state.topicsStore.validation)
  const joinValidation = useStore((state) => state.joinStore.validation)
  const clickhouseConnectionValidation = useStore((state) => state.clickhouseConnectionStore.validation)
  const clickhouseDestinationValidation = useStore((state) => state.clickhouseDestinationStore.validation)

  const handleMarkSectionValid = (section: StepKeys) => {
    validationEngine.onSectionConfigured(section)
  }

  const handleResetSection = (section: StepKeys) => {
    validationEngine.onSectionReset(section)
  }

  const handleResetAll = () => {
    validationEngine.resetAllValidations()
  }

  const ValidationStatus = ({ title, validation, section }: { title: string; validation: any; section: StepKeys }) => (
    <div className="p-4 border rounded-lg">
      <h3 className="font-medium mb-2">{title}</h3>
      <div className="mb-2">
        <span
          className={`px-2 py-1 rounded text-sm ${
            validation.status === 'valid'
              ? 'bg-green-100 text-green-800'
              : validation.status === 'invalidated'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
          }`}
        >
          {validation.status}
        </span>
        {validation.invalidatedBy && <span className="ml-2 text-sm text-gray-600">by {validation.invalidatedBy}</span>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => handleMarkSectionValid(section)} className="text-xs">
          Mark Valid
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleResetSection(section)} className="text-xs">
          Reset
        </Button>
      </div>
    </div>
  )

  return (
    <div className="p-6 bg-white rounded-lg border">
      <h2 className="text-xl font-bold mb-4">Validation System Demo</h2>
      <p className="text-gray-600 mb-6">
        Try marking sections as valid to see how dependent sections get invalidated automatically.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <ValidationStatus title="Kafka Connection" validation={kafkaValidation} section={StepKeys.KAFKA_CONNECTION} />
        <ValidationStatus title="Topic Selection" validation={topicsValidation} section={StepKeys.TOPIC_SELECTION_1} />
        <ValidationStatus title="Join Configuration" validation={joinValidation} section={StepKeys.JOIN_CONFIGURATOR} />
        <ValidationStatus
          title="ClickHouse Connection"
          validation={clickhouseConnectionValidation}
          section={StepKeys.CLICKHOUSE_CONNECTION}
        />
        <ValidationStatus
          title="ClickHouse Mapping"
          validation={clickhouseDestinationValidation}
          section={StepKeys.CLICKHOUSE_MAPPER}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleResetAll} variant="outline">
          Reset All Validations
        </Button>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">How it works:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Configure Kafka → Topics, Join, and ClickHouse become invalidated</li>
          <li>• Configure Topics → Join and ClickHouse Mapping become invalidated</li>
          <li>• Configure Join → ClickHouse Mapping becomes invalidated</li>
          <li>• Each section shows why it was invalidated</li>
        </ul>
      </div>
    </div>
  )
}

export default ValidationDemo
