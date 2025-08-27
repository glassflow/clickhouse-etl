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
      <ClickhouseConnectionFormManager
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
        initialValues={initialValues}
        host={directConnection?.host || ''}
        httpPort={directConnection?.httpPort || ''}
        username={directConnection?.username || ''}
        password={directConnection?.password || ''}
        nativePort={directConnection?.nativePort || ''}
        useSSL={directConnection?.useSSL ?? true}
        skipCertificateVerification={directConnection?.skipCertificateVerification ?? true}
        toggleEditMode={toggleEditMode}
        pipelineActionState={pipelineActionState}
        onClose={onCompleteStandaloneEditing}
      />

      {connectionStatus === 'success' && !clearErrorMessage && (
        <ActionStatusMessage message="Successfully connected to ClickHouse!" success={true} />
      )}

      {connectionStatus === 'error' && !clearErrorMessage && (
        <ActionStatusMessage message={connectionError || 'Connection failed'} success={false} />
      )}
    </>
  )
}
