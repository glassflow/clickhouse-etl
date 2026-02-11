import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createPipeline } from '@/src/api/pipeline-api'
import { Pipeline } from '@/src/types/pipeline'
import { StepKeys } from '@/src/config/constants'
import { LATEST_PIPELINE_VERSION } from '@/src/config/pipeline-versions'
import { useStore } from '@/src/store'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { ModalResult } from '@/src/components/common/InfoModal'
import { validateColumnMappings, getMappingType, generateApiConfig } from '../utils'
import type { TableColumn, TableSchema } from '../types'
import type { ValidationResult } from '../types'

export interface UseDestinationSaveParams {
  validateMapping: () => ValidationResult | null
  selectedDatabase: string
  selectedTable: string
  mappedColumns: TableColumn[]
  tableSchema: TableSchema
  maxDelayTimeRef: React.MutableRefObject<number>
  maxDelayTimeUnitRef: React.MutableRefObject<string>
  maxBatchSizeRef: React.MutableRefObject<number>
  selectedTopics: any[]
  standalone?: boolean
  toggleEditMode?: () => void
  onCompleteStandaloneEditing?: () => void
  onCompleteStep?: (step: StepKeys) => void
}

const getRuntimeEnv = () => ({
  NEXT_PUBLIC_PREVIEW_MODE: process.env.NEXT_PUBLIC_PREVIEW_MODE,
})
const runtimeEnv = getRuntimeEnv()
const isPreviewMode =
  runtimeEnv.NEXT_PUBLIC_PREVIEW_MODE === 'true' ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PREVIEW_MODE === 'true')

export interface ModalState {
  visible: boolean
  message: string
  title: string
  okButtonText: string
  cancelButtonText: string
  type: 'info' | 'warning' | 'error'
}

/**
 * Hook that owns save flow, deploy, discard, download failed config,
 * and modal/pending state for validation. Keeps save/deploy logic and feedback in one place.
 */
export function useDestinationSave({
  validateMapping,
  selectedDatabase,
  selectedTable,
  mappedColumns,
  tableSchema,
  maxDelayTimeRef,
  maxDelayTimeUnitRef,
  maxBatchSizeRef,
  selectedTopics,
  standalone,
  toggleEditMode,
  onCompleteStandaloneEditing,
  onCompleteStep,
}: UseDestinationSaveParams) {
  const router = useRouter()
  const analytics = useJourneyAnalytics()
  const {
    clickhouseConnectionStore,
    clickhouseDestinationStore,
    coreStore,
    joinStore,
    kafkaStore,
    deduplicationStore,
    filterStore,
    transformationStore,
  } = useStore()

  const { clickhouseConnection } = clickhouseConnectionStore
  const { clickhouseDestination, setClickhouseDestination } = clickhouseDestinationStore
  const {
    setApiConfig,
    setPipelineId,
    pipelineId,
    pipelineName,
    pipelineVersion,
  } = coreStore

  const [pendingAction, setPendingAction] = useState<'none' | 'save'>('none')
  const [failedDeploymentConfig, setFailedDeploymentConfig] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [modalProps, setModalProps] = useState<ModalState>({
    visible: false,
    message: '',
    title: '',
    okButtonText: 'Yes',
    cancelButtonText: 'No',
    type: 'info',
  })

  const deployPipelineAndNavigateRef = useRef<(_: any) => Promise<void>>(async () => {})

  const completeConfigSave = useCallback(() => {
    const { invalidMappings, missingTypeMappings } = validateColumnMappings(mappedColumns)

    if (invalidMappings.length > 0) {
      const incompatibleFields = invalidMappings
        .map((m) => `${m.name} (${m.jsonType} → ${m.type})`)
        .join(', ')
      setError(
        `Type compatibility issues remain: ${incompatibleFields}. Please fix these before continuing.`,
      )
      return
    }

    if (missingTypeMappings.length > 0) {
      const missingFields = missingTypeMappings
        .map((m) => `${m.name} (mapped to ${m.eventField})`)
        .join(', ')
      setError(
        `Some mapped fields are missing type information: ${missingFields}. Please review these mappings.`,
      )
      return
    }

    const totalColumns = tableSchema.columns.length
    const mappedCount = mappedColumns.filter((col) => col.eventField).length
    const mappingPercentage = totalColumns > 0 ? Math.round((mappedCount / totalColumns) * 100) : 0

    analytics.destination.mappingCompleted({
      count: mappedColumns.length,
      totalColumns,
      mappingPercentage,
      batchSize: maxBatchSizeRef.current,
      delayTime: maxDelayTimeRef.current,
      delayUnit: maxDelayTimeUnitRef.current,
    })

    const currentMaxDelayTime = maxDelayTimeRef.current
    const currentMaxDelayTimeUnit = maxDelayTimeUnitRef.current
    const currentMaxBatchSize = maxBatchSizeRef.current

    const updatedDestination = {
      ...clickhouseDestination,
      database: selectedDatabase,
      table: selectedTable,
      mapping: mappedColumns,
      destinationColumns: tableSchema.columns,
      maxBatchSize: currentMaxBatchSize,
      maxDelayTime: currentMaxDelayTime,
      maxDelayTimeUnit: currentMaxDelayTimeUnit,
    }

    const apiConfig = generateApiConfig({
      pipelineId,
      pipelineName,
      setPipelineId,
      clickhouseConnection,
      clickhouseDestination: updatedDestination,
      selectedTopics,
      getMappingType,
      joinStore,
      kafkaStore,
      deduplicationStore,
      filterStore,
      transformationStore,
      version: pipelineVersion,
    })

    setClickhouseDestination(updatedDestination)
    clickhouseDestinationStore.markAsValid()
    setApiConfig(apiConfig as Partial<Pipeline>)

    setSuccess('Destination configuration saved successfully!')
    setTimeout(() => setSuccess(null), 3000)

    if (standalone && toggleEditMode) {
      coreStore.markAsDirty()
      if (onCompleteStandaloneEditing) {
        onCompleteStandaloneEditing()
      }
      return
    }

    if (isPreviewMode && onCompleteStep) {
      onCompleteStep(StepKeys.CLICKHOUSE_MAPPER)
    } else {
      deployPipelineAndNavigateRef.current(apiConfig)
    }
  }, [
    mappedColumns,
    tableSchema.columns,
    selectedDatabase,
    selectedTable,
    clickhouseDestination,
    clickhouseConnection,
    selectedTopics,
    pipelineId,
    pipelineName,
    pipelineVersion,
    setPipelineId,
    setClickhouseDestination,
    setApiConfig,
    clickhouseDestinationStore,
    coreStore,
    joinStore,
    kafkaStore,
    deduplicationStore,
    filterStore,
    transformationStore,
    analytics.destination,
    standalone,
    toggleEditMode,
    onCompleteStandaloneEditing,
    onCompleteStep,
  ])

  const deployPipelineAndNavigate = useCallback(async (apiConfig: any) => {
    try {
      setFailedDeploymentConfig(null)
      await createPipeline(apiConfig)
      const newPipelineId = apiConfig?.pipeline_id || ''
      setPipelineId(newPipelineId)
      router.push(`/pipelines/${newPipelineId}?deployment=progress`)
    } catch (err: any) {
      console.error('deployPipelineAndNavigate: Failed to deploy pipeline:', err)
      setError(`Failed to deploy pipeline: ${err.message}`)
      setFailedDeploymentConfig(apiConfig)
    }
  }, [setPipelineId, router])

  deployPipelineAndNavigateRef.current = deployPipelineAndNavigate

  const saveDestinationConfig = useCallback(() => {
    setPendingAction('save')
    analytics.destination.columnsSelected({ count: mappedColumns.length })

    const validationResult = validateMapping()

    if (validationResult) {
      setModalProps({
        visible: true,
        title: validationResult.title,
        message: validationResult.message,
        okButtonText: validationResult.okButtonText,
        cancelButtonText: validationResult.cancelButtonText,
        type: validationResult.type,
      })
    } else {
      completeConfigSave()
    }
  }, [validateMapping, mappedColumns.length, analytics.destination, completeConfigSave])

  const handleDiscardChanges = useCallback(() => {
    coreStore.discardSection('clickhouse-destination')
  }, [coreStore])

  const handleDownloadFailedConfig = useCallback(() => {
    if (!failedDeploymentConfig) return

    try {
      const downloadConfig = {
        ...failedDeploymentConfig,
        exported_at: new Date().toISOString(),
        exported_by: 'GlassFlow UI',
        version: LATEST_PIPELINE_VERSION,
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
      const configName = failedDeploymentConfig.name || pipelineName || 'pipeline'
      const sanitizedName = configName.replace(/[^a-zA-Z0-9-_]/g, '_')
      const filename = `${sanitizedName}_config_${timestamp}.json`

      const blob = new Blob([JSON.stringify(downloadConfig, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      console.error('Failed to download configuration:', downloadError)
    }
  }, [failedDeploymentConfig, pipelineName])

  const onModalComplete = useCallback(
    (result: (typeof ModalResult)[keyof typeof ModalResult]) => {
      setModalProps((prev) => ({ ...prev, visible: false }))
      if (result === ModalResult.YES) {
        if (modalProps.type === 'error') {
          setError('Please fix the validation errors before proceeding.')
        } else {
          completeConfigSave()
        }
      }
      setPendingAction('none')
    },
    [modalProps.type, completeConfigSave],
  )

  useEffect(() => {
    return () => {
      setModalProps((prev) => ({ ...prev, visible: false }))
    }
  }, [])

  return {
    saveDestinationConfig,
    completeConfigSave,
    handleDiscardChanges,
    handleDownloadFailedConfig,
    deployPipelineAndNavigate,
    onModalComplete,
    pendingAction,
    failedDeploymentConfig,
    modalProps,
    setModalProps,
    error,
    setError,
    success,
  }
}
