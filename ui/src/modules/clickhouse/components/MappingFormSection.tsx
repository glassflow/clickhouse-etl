import { BatchDelaySelector } from './BatchDelaySelector'
import { FieldColumnMapper } from './FieldColumnMapper'
import FormActions from '@/src/components/shared/FormActions'
import { TableColumn } from '../types'

interface MappingFormSectionProps {
  // Batch/delay configuration
  maxBatchSize: number
  maxDelayTime: number
  maxDelayTimeUnit: string
  onMaxBatchSizeChange: (value: number) => void
  onMaxDelayTimeChange: (value: number) => void
  onMaxDelayTimeUnitChange: (value: string) => void

  // Mapping data
  eventFields: string[]
  mappedColumns: TableColumn[]
  updateColumnMapping: (index: number, field: keyof TableColumn, value: any) => void
  mapEventFieldToColumn: (index: number, eventField: string, source?: 'primary' | 'secondary') => void

  // Join mode fields (optional)
  primaryEventFields?: string[]
  secondaryEventFields?: string[]
  primaryTopicName?: string
  secondaryTopicName?: string
  isJoinMapping: boolean

  // Validation issues for highlighting
  unmappedNonNullableColumns: string[]
  unmappedDefaultColumns: string[]

  // Actions
  onRefreshTableSchema: () => Promise<void>
  onAutoMap: () => boolean
  onSubmit: () => void
  onDiscard: () => void

  // Database/table info for context
  selectedDatabase: string
  selectedTable: string

  // UI state
  readOnly?: boolean
  isLoading: boolean
  isSuccess: boolean

  // Standalone mode props
  standalone?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
  onClose?: () => void
}

/**
 * Renders the mapping form section including:
 * - Batch size and delay time configuration
 * - Field-to-column mapper
 * - Form action buttons (Continue/Discard)
 *
 * This component is displayed when a table is selected and schema is available.
 * It handles both single-topic and join (multi-topic) mapping modes.
 */
export function MappingFormSection({
  maxBatchSize,
  maxDelayTime,
  maxDelayTimeUnit,
  onMaxBatchSizeChange,
  onMaxDelayTimeChange,
  onMaxDelayTimeUnitChange,
  eventFields,
  mappedColumns,
  updateColumnMapping,
  mapEventFieldToColumn,
  primaryEventFields,
  secondaryEventFields,
  primaryTopicName,
  secondaryTopicName,
  isJoinMapping,
  unmappedNonNullableColumns,
  unmappedDefaultColumns,
  onRefreshTableSchema,
  onAutoMap,
  onSubmit,
  onDiscard,
  selectedDatabase,
  selectedTable,
  readOnly,
  isLoading,
  isSuccess,
  standalone,
  toggleEditMode,
  pipelineActionState,
  onClose,
}: MappingFormSectionProps) {
  return (
    <div className="transform transition-all duration-300 ease-in-out translate-y-4 opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]">
      <BatchDelaySelector
        maxBatchSize={maxBatchSize}
        maxDelayTime={maxDelayTime}
        maxDelayTimeUnit={maxDelayTimeUnit}
        onMaxBatchSizeChange={onMaxBatchSizeChange}
        onMaxDelayTimeChange={onMaxDelayTimeChange}
        onMaxDelayTimeUnitChange={onMaxDelayTimeUnitChange}
        readOnly={readOnly}
      />
      <FieldColumnMapper
        eventFields={eventFields}
        // @ts-expect-error - mappedColumns is not typed correctly
        mappedColumns={mappedColumns}
        updateColumnMapping={updateColumnMapping}
        mapEventFieldToColumn={mapEventFieldToColumn}
        primaryEventFields={isJoinMapping ? primaryEventFields : undefined}
        secondaryEventFields={isJoinMapping ? secondaryEventFields : undefined}
        primaryTopicName={isJoinMapping ? primaryTopicName : undefined}
        secondaryTopicName={isJoinMapping ? secondaryTopicName : undefined}
        isJoinMapping={isJoinMapping}
        readOnly={readOnly}
        typesReadOnly={true} // Types are verified in the earlier type verification step
        unmappedNonNullableColumns={unmappedNonNullableColumns}
        unmappedDefaultColumns={unmappedDefaultColumns}
        onRefreshTableSchema={onRefreshTableSchema}
        onAutoMap={onAutoMap}
        selectedDatabase={selectedDatabase}
        selectedTable={selectedTable}
      />
      {/* TypeCompatibilityInfo is temporarily hidden */}
      {/* <TypeCompatibilityInfo /> */}
      <div className="flex gap-2 mt-4">
        <FormActions
          standalone={standalone}
          onSubmit={onSubmit}
          onDiscard={onDiscard}
          isLoading={isLoading}
          isSuccess={isSuccess}
          disabled={isLoading}
          successText="Continue"
          actionType="primary"
          showLoadingIcon={false}
          regularText="Continue"
          loadingText="Saving..."
          readOnly={readOnly}
          toggleEditMode={toggleEditMode}
          pipelineActionState={pipelineActionState}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
