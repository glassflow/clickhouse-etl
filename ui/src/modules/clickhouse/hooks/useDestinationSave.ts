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
import { sanitizePipelineResourcesForSubmit } from '@/src/modules/resources/utils'
import { downloadFailedConfig } from '@/src/utils/pipeline-download'
import type { TableColumn, TableSchema } from '../types'
import type { ValidationResult } from '../types'
import type { DownloadFormat } from '@/src/components/common/DownloadFormatModal'

export interface UseDestinationSaveParams {
  validateMapping: () => ValidationResult | null
  destinationPath: 'create' | 'existing'
  selectedDatabase: string
  selectedTable: string
  tableName?: string
  engine?: string
  orderBy?: string
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
  destinationPath,
  selectedDatabase,
  selectedTable,
  tableName,
  engine,
  orderBy,
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
    resourcesStore,
  } = useStore()

  const { clickhouseConnection } = clickhouseConnectionStore
  const { clickhouseDestination, setClickhouseDestination } = clickhouseDestinationStore
  const {
    setApiConfig,
    setPipelineId,
    pipelineId,
    pipelineName,
    pipelineVersion,
    lastSavedConfig,
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

    const effectiveTable = destinationPath === 'create' ? (tableName ?? '') : selectedTable
    const updatedDestination = {
      ...clickhouseDestination,
      database: selectedDatabase,
      table: effectiveTable,
      tableName: destinationPath === 'create' ? (tableName ?? '') : undefined,
      engine: destinationPath === 'create' ? (engine ?? '') : undefined,
      orderBy: destinationPath === 'create' ? (orderBy ?? '') : undefined,
      mapping: mappedColumns,
      destinationColumns: tableSchema.columns,
      maxBatchSize: currentMaxBatchSize,
      maxDelayTime: currentMaxDelayTime,
      maxDelayTimeUnit: currentMaxDelayTimeUnit,
    }

    const rawResources = resourcesStore.pipeline_resources
    const pipeline_resources =
      rawResources && lastSavedConfig?.pipeline_resources
        ? sanitizePipelineResourcesForSubmit(
            lastSavedConfig.pipeline_resources,
            rawResources,
            resourcesStore.fields_policy?.immutable ?? []
          )
        : rawResources

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
      pipeline_resources,
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

    // Create flow (wizard): always advance to the next step (Resources) after saving mapping.
    // Deployment happens from the Resources step (or Review step when preview mode is on).
    if (onCompleteStep) {
      onCompleteStep(StepKeys.CLICKHOUSE_MAPPER)
    } else {
      // No wizard (e.g. direct call): deploy when preview mode is off
      if (!isPreviewMode) {
        deployPipelineAndNavigateRef.current(apiConfig)
      }
    }
  }, [
    mappedColumns,
    tableSchema.columns,
    destinationPath,
    tableName,
    engine,
    orderBy,
    selectedDatabase,
    selectedTable,
    clickhouseDestination,
    clickhouseConnection,
    selectedTopics,
    pipelineId,
    pipelineName,
    pipelineVersion,
    lastSavedConfig,
    setPipelineId,
    setClickhouseDestination,
    setApiConfig,
    clickhouseDestinationStore,
    coreStore,
    resourcesStore,
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
      const orphanTable = err?.orphanTable as { database?: string; table?: string; message?: string } | undefined
      const errorMessage = orphanTable
        ? `${err.message || 'Failed to deploy pipeline'}. ${orphanTable.message || ''} Table: ${orphanTable.database ?? ''}.${orphanTable.table ?? ''}`
        : `Failed to deploy pipeline: ${err.message}`
      setError(errorMessage)
      setFailedDeploymentConfig(apiConfig)
    }
  }, [setPipelineId, router])

  deployPipelineAndNavigateRef.current = deployPipelineAndNavigate

  const saveDestinationConfig = useCallback(() => {
    setPendingAction('save')
    if (destinationPath === 'create') {
      if (!tableName?.trim()) {
        setError('Enter table name')
        setPendingAction('none')
        return
      }
      if (!selectedDatabase) {
        setError('Select database')
        setPendingAction('none')
        return
      }
      if (!engine) {
        setError('Select table engine')
        setPendingAction('none')
        return
      }
      if (!orderBy) {
        setError('Select field to order by')
        setPendingAction('none')
        return
      }
    }
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
  }, [
    destinationPath,
    tableName,
    selectedDatabase,
    engine,
    orderBy,
    validateMapping,
    mappedColumns.length,
    analytics.destination,
    completeConfigSave,
  ])

  const handleDiscardChanges = useCallback(() => {
    coreStore.discardSection('clickhouse-destination')
  }, [coreStore])

  const handleDownloadFailedConfig = useCallback(
    (format: DownloadFormat = 'yaml') => {
      if (!failedDeploymentConfig) return
      try {
        const config = { ...failedDeploymentConfig, name: failedDeploymentConfig.name || pipelineName || 'pipeline' }
        downloadFailedConfig(config, format, LATEST_PIPELINE_VERSION)
      } catch (downloadError) {
        console.error('Failed to download configuration:', downloadError)
      }
    },
    [failedDeploymentConfig, pipelineName],
  )

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
