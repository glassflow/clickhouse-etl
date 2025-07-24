'use client'

import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/src/store'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useClickhouseConnection } from '@/src/hooks/useClickhouseConnection'
import { StepKeys } from '@/src/config/constants'
import { ClickhouseConnectionFormManager } from './components/ClickhouseConnectionFormManager'
import { ClickhouseConnectionFormType } from '@/src/scheme/clickhouse.scheme'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

export function ClickhouseConnectionContainer({
  onCompleteStep,
  onComplete,
  standalone,
  readOnly = false,
}: {
  onCompleteStep?: (step: StepKeys) => void
  onComplete?: () => void
  standalone?: boolean
  readOnly?: boolean
}) {
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
      port: directConnection?.port || '',
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
    // Save the connection details to the store
    const newConnection = {
      ...clickhouseConnection,
      directConnection: {
        host: values.directConnection.host,
        port: values.directConnection.port,
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
    } else if (standalone && onComplete) {
      onComplete()
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

    // First save the connection details to the store with loading status
    const newConnection = {
      ...clickhouseConnection,
      directConnection: {
        host: values.directConnection.host,
        port: values.directConnection.port,
        username: values.directConnection.username,
        password: values.directConnection.password,
        nativePort: values.directConnection.nativePort,
        useSSL: values.directConnection.useSSL,
        skipCertificateVerification: values.directConnection.skipCertificateVerification,
      },
      connectionStatus: 'loading' as const,
      connectionError: null,
    }

    setClickhouseConnection(newConnection)

    // Test the connection with the form values
    const result = await testConnection({
      host: values.directConnection.host,
      port: values.directConnection.port,
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

  return (
    <>
      <ClickhouseConnectionFormManager
        onTestConnection={handleTestConnection}
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
        port={directConnection?.port || ''}
        username={directConnection?.username || ''}
        password={directConnection?.password || ''}
        nativePort={directConnection?.nativePort || ''}
        useSSL={directConnection?.useSSL ?? true}
        skipCertificateVerification={directConnection?.skipCertificateVerification ?? true}
      />

      {connectionStatus === 'success' && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md flex items-center">
          <CheckCircleIcon className="h-5 w-5 mr-2" />
          <span>Successfully connected to ClickHouse!</span>
        </div>
      )}

      {connectionStatus === 'error' && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md flex items-center">
          <XCircleIcon className="h-5 w-5 mr-2" />
          <div>
            <p className="font-medium">Connection failed</p>
            {connectionError && <p className="text-sm">{connectionError}</p>}
          </div>
        </div>
      )}
    </>
  )
}
