'use client'

import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/src/store'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useClickhouseConnection } from '@/src/hooks/useClickhouseConnection'
import { StepKeys } from '@/src/config/constants'
import { ClickhouseConnectionFormManager } from './components/ClickhouseConnectionFormManager'
import { ClickhouseConnectionFormType } from '@/src/scheme/clickhouse.scheme'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import ActionStatusMessage from '@/src/components/shared/ActionStatusMessage'
import { SaveToLibraryPrompt } from '@/src/components/common/SaveToLibraryPrompt'
import { UseSavedConnectionChips } from '@/src/components/common/UseSavedConnectionChips'

export function ClickhouseConnectionContainer({
  onCompleteStep,
  onCompleteStandaloneEditing,
  standalone,
  readOnly = false,
  toggleEditMode,
  pipelineActionState,
}: {
  onCompleteStep?: (step: StepKeys) => void
  onCompleteStandaloneEditing?: () => void
  standalone?: boolean
  readOnly?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
}) {
  const [clearErrorMessage, setClearErrorMessage] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [prefillKey, setPrefillKey] = useState(0)
  const [prefillValues, setPrefillValues] = useState<ClickhouseConnectionFormType | null>(null)
  const { clickhouseConnectionStore } = useStore()
  const analytics = useJourneyAnalytics()

  const { clickhouseConnection, setClickhouseConnection } = clickhouseConnectionStore
  const { directConnection } = clickhouseConnection

  const [hasTrackedView, setHasTrackedView] = useState(false)
  const [connectionFormValues, setConnectionFormValues] = useState<ClickhouseConnectionFormType | null>(null)

  const { isLoading, connectionStatus, connectionError, testConnection } = useClickhouseConnection()

  // Prepare initial values by merging defaults with store values
  const initialValues: ClickhouseConnectionFormType = {
    connectionType: 'direct',
    directConnection: {
      host: directConnection?.host || '',
      httpPort: directConnection?.httpPort || '',
      username: directConnection?.username || '',
      password: directConnection?.password || '',
      nativePort: directConnection?.nativePort || '',
      useSSL: directConnection?.useSSL ?? true,
      skipCertificateVerification: directConnection?.skipCertificateVerification ?? true,
    },
  }

  // Track when user views this step
  useEffect(() => {
    if (!hasTrackedView) {
      analytics.page.setupClickhouseConnection({
        isReturningVisit: !!directConnection?.host,
      })
      setHasTrackedView(true)
    }
  }, [hasTrackedView, analytics.page, directConnection?.host])

  // runs after successful test connection or failed test connection
  useEffect(() => {
    if (connectionStatus === 'success') {
      // Track successful ClickHouse connection
      analytics.clickhouse.success({
        host: connectionFormValues?.directConnection.host,
        useSSL: connectionFormValues?.directConnection.useSSL,
      })
    } else if (connectionStatus === 'error') {
      // Track failed ClickHouse connection
      analytics.clickhouse.failed({
        error: connectionError || 'Unknown connection error',
        host: connectionFormValues?.directConnection.host,
      })
    }
  }, [connectionStatus, connectionError, connectionFormValues, analytics.clickhouse])

  const saveConnectionData = (values: ClickhouseConnectionFormType) => {
    // Save the connection details to the store only after successful test
    const newConnection = {
      ...clickhouseConnection,
      directConnection: {
        host: values.directConnection.host,
        httpPort: values.directConnection.httpPort,
        username: values.directConnection.username,
        password: values.directConnection.password,
        nativePort: values.directConnection.nativePort,
        useSSL: values.directConnection.useSSL,
        skipCertificateVerification: values.directConnection.skipCertificateVerification,
      },
      connectionStatus: 'success' as const,
      connectionError: null,
    }

    setClickhouseConnection(newConnection)

    // If in standalone edit mode, mark configuration as dirty
    // This indicates changes need to be sent to backend when user clicks Resume
    if (standalone && toggleEditMode) {
      const { coreStore, clickhouseDestinationStore } = useStore.getState()
      coreStore.markAsDirty()

      // Invalidate dependent sections when ClickHouse connection is edited
      // When ClickHouse connection changes, only invalidate the mapper section
      // This ensures the user reconfigures table mapping for the new connection
      clickhouseDestinationStore.markAsInvalidated(StepKeys.CLICKHOUSE_CONNECTION)
    }

    // Proceed to next step
    if (!standalone && onCompleteStep) {
      onCompleteStep(StepKeys.CLICKHOUSE_CONNECTION)
    } else if (standalone && onCompleteStandaloneEditing) {
      onCompleteStandaloneEditing()
    }
  }

  const handleTestConnection = async (values: ClickhouseConnectionFormType) => {
    // Track connection attempt
    analytics.clickhouse.started({
      host: values.directConnection.host,
      useSSL: values.directConnection.useSSL,
    })

    // save local version of the form values to be used in the analytics
    setConnectionFormValues(values)

    // Test the connection with the form values FIRST
    const result = await testConnection({
      host: values.directConnection.host,
      httpPort: values.directConnection.httpPort,
      username: values.directConnection.username,
      password: values.directConnection.password,
      nativePort: values.directConnection.nativePort,
      useSSL: values.directConnection.useSSL,
      skipCertificateVerification: values.directConnection.skipCertificateVerification,
    })

    // Only save data and complete step if connection was successful
    if (result?.success && result.databases?.length > 0) {
      saveConnectionData(values)
    }
  }

  // Show save prompt on successful test (wizard mode only)
  useEffect(() => {
    if (connectionStatus === 'success' && !standalone) {
      setShowSavePrompt(true)
    }
  }, [connectionStatus, standalone])

  const handleSaveToLibrary = async (name: string) => {
    const res = await fetch('/ui-api/library/connections/clickhouse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, config: connectionFormValues ?? {} }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error ?? 'Failed to save connection')
    }
  }

  const handleChipSelect = (config: Record<string, unknown>) => {
    setPrefillValues(config as unknown as ClickhouseConnectionFormType)
    setPrefillKey((k) => k + 1)
  }

  const handleDiscardConnectionChange = () => {
    // Clear any error messages when discarding changes
    // Reset connection status to clear any error states
    const resetConnection = {
      ...clickhouseConnection,
      connectionStatus: 'idle' as const,
      connectionError: null,
    }
    setClickhouseConnection(resetConnection)
    setClearErrorMessage(true)
  }

  return (
    <>
      {!readOnly && (
        <UseSavedConnectionChips connectionType="clickhouse" onSelect={handleChipSelect} />
      )}
      <ClickhouseConnectionFormManager
        key={prefillKey}
        onTestConnection={handleTestConnection}
        onDiscardConnectionChange={handleDiscardConnectionChange}
        isConnecting={isLoading}
        connectionResult={
          connectionStatus === 'success'
            ? { success: true, message: 'Successfully connected to ClickHouse!' }
            : connectionStatus === 'error'
              ? { success: false, message: connectionError || 'Connection failed' }
              : null
        }
        readOnly={readOnly}
        standalone={standalone}
        initialValues={prefillValues ?? initialValues}
        host={(prefillValues?.directConnection?.host ?? directConnection?.host) || ''}
        httpPort={(prefillValues?.directConnection?.httpPort ?? directConnection?.httpPort) || ''}
        username={(prefillValues?.directConnection?.username ?? directConnection?.username) || ''}
        password={(prefillValues?.directConnection?.password ?? directConnection?.password) || ''}
        nativePort={(prefillValues?.directConnection?.nativePort ?? directConnection?.nativePort) || ''}
        useSSL={prefillValues?.directConnection?.useSSL ?? directConnection?.useSSL ?? true}
        skipCertificateVerification={prefillValues?.directConnection?.skipCertificateVerification ?? directConnection?.skipCertificateVerification ?? true}
        toggleEditMode={toggleEditMode}
        pipelineActionState={pipelineActionState}
        onClose={onCompleteStandaloneEditing}
      />
      {showSavePrompt && (
        <SaveToLibraryPrompt
          connectionType="clickhouse"
          onSave={handleSaveToLibrary}
          onDismiss={() => setShowSavePrompt(false)}
        />
      )}
    </>
  )
}
