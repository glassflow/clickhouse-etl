'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useClickhouseConnection } from '@/src/hooks/clickhouse-mng-hooks'
import { StepKeys } from '@/src/config/constants'
import { cn } from '@/src/utils'
import { ClickhouseConnectionFormConfig } from '@/src/config/clickhouse-connection-form-config'
import { renderFormField } from '@/src/components/ui/form'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ClickhouseConnectionFormSchema, ClickhouseConnectionFormType } from '@/src/scheme/clickhouse.scheme'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { generateConnectionId } from '@/src/utils/common.client'

export function ClickhouseConnectionSetup({ onNext }: { onNext: (step: StepKeys) => void }) {
  const { clickhouseStore } = useStore()
  const analytics = useJourneyAnalytics()

  const { clickhouseConnection, setClickhouseConnection, updateDatabases, updateTables } = clickhouseStore

  const { directConnection } = clickhouseConnection
  const { directConnectionForm } = ClickhouseConnectionFormConfig

  const [hasInteracted, setHasInteracted] = useState(false)
  const [hasTrackedView, setHasTrackedView] = useState(false)

  const formMethod = useForm<ClickhouseConnectionFormType>({
    resolver: zodResolver(ClickhouseConnectionFormSchema),
    defaultValues: {
      connectionType: 'direct',
      directConnection: {
        host: directConnection?.host || '',
        port: directConnection?.port || '',
        username: directConnection?.username || '',
        password: directConnection?.password || '',
        nativePort: directConnection?.nativePort || '',
        useSSL: directConnection?.useSSL || true,
        skipCertificateVerification: directConnection?.skipCertificateVerification || true,
      },
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
  } = formMethod

  // Track when user views this step
  useEffect(() => {
    if (!hasTrackedView) {
      analytics.page.setupClickhouseConnection({
        isReturningVisit: !!directConnection?.host,
      })
      setHasTrackedView(true)
    }
  }, [hasTrackedView, analytics.page, directConnection?.host])

  // Track when user interacts with the form
  useEffect(() => {
    if (isDirty && !hasInteracted) {
      setHasInteracted(true)
    }
  }, [isDirty, hasInteracted, directConnection?.host])

  // Set default values for useSSL and skipCertificateVerification
  useEffect(() => {
    setValue('directConnection.useSSL', true)
    setValue('directConnection.skipCertificateVerification', true)
  }, [setValue])

  const { isLoading, connectionStatus, connectionError, testConnection } = useClickhouseConnection()

  // form submit handler
  const onSubmit = useCallback(
    async (values: ClickhouseConnectionFormType) => {
      // Track connection attempt
      analytics.clickhouse.started({
        host: values.directConnection.host,
        useSSL: values.directConnection.useSSL,
      })

      // @ts-expect-error - FIXME: fix this later
      const result = await testConnection(values.directConnection)

      if (result.success && result.databases.length > 0) {
        // Track successful connection
        analytics.clickhouse.success({
          host: values.directConnection.host,
          databaseCount: result.databases?.length || 0,
        })

        // save the connection details in the store
        saveConnection(values)

        // Then update the databases from the new connection
        updateDatabases(
          result.databases,
          generateConnectionId({
            type: 'direct',
            cleanHost: values.directConnection.host,
            port: parseInt(values.directConnection.port),
            username: values.directConnection.username,
            password: values.directConnection.password,
          }),
        )
      } else {
        // Track connection error
        analytics.clickhouse.failed({
          error: result.error || 'Unknown connection error',
          host: values.directConnection.host,
        })
      }
    },
    [analytics.clickhouse, testConnection, updateDatabases],
  )

  // helper function to save the connection details in the store
  const saveConnection = useCallback(
    (formValues: ClickhouseConnectionFormType) => {
      // Check if connection details have changed from previous values
      const prevConnection = clickhouseConnection.directConnection
      const hasConnectionChanged =
        prevConnection.host !== formValues.directConnection.host ||
        prevConnection.port !== formValues.directConnection.port ||
        prevConnection.username !== formValues.directConnection.username ||
        prevConnection.password !== formValues.directConnection.password

      const connector: ClickhouseConnectionFormType = {
        connectionType: 'direct',
        directConnection: {
          host: formValues.directConnection.host,
          port: formValues.directConnection.port,
          username: formValues.directConnection.username,
          password: formValues.directConnection.password,
          nativePort: formValues.directConnection.nativePort,
          useSSL: formValues.directConnection.useSSL,
          skipCertificateVerification: formValues.directConnection.skipCertificateVerification,
        },
        connectionStatus: 'success',
        connectionError: null,
      }

      // Update the connection in the store
      setClickhouseConnection(connector)

      // Proceed to next step
      onNext(StepKeys.CLICKHOUSE_CONNECTION)
    },
    [setClickhouseConnection, onNext, clickhouseConnection.directConnection],
  )

  return (
    <div className="flex flex-col gap-8">
      <FormProvider {...formMethod}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {renderFormField({
                field: {
                  ...directConnectionForm.fields.host,
                  readOnly: isLoading,
                },
                register,
                errors,
              })}
            </div>

            <div className="space-y-2">
              {renderFormField({
                field: {
                  ...directConnectionForm.fields.port,
                  readOnly: isLoading,
                },
                register,
                errors,
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {renderFormField({
                field: {
                  ...directConnectionForm.fields.username,
                  readOnly: isLoading,
                },
                register,
                errors,
              })}
            </div>

            <div className="space-y-2">
              {renderFormField({
                field: {
                  ...directConnectionForm.fields.password,
                  readOnly: isLoading,
                },
                register,
                errors,
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {renderFormField({
                field: {
                  ...directConnectionForm.fields.nativePort,
                  readOnly: isLoading,
                },
                register,
                errors,
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {renderFormField({
                // @ts-expect-error - FIXME: fix this later
                field: directConnectionForm.fields.useSSL,
                register,
                errors,
              })}
            </div>

            <div className="space-y-2">
              {renderFormField({
                // @ts-expect-error - FIXME: fix this later
                field: directConnectionForm.fields.skipCertificateVerification,
                register,
                errors,
              })}
            </div>
          </div>

          <div className="flex justify-start gap-4 mt-6">
            <Button
              variant={connectionStatus === 'success' ? 'gradient' : 'outline'}
              type="submit"
              disabled={isLoading}
              className={cn('btn-primary', {
                'btn-text-disabled': !connectionStatus,
                'btn-text': connectionStatus,
              })}
            >
              {isLoading ? 'Testing...' : 'Continue'}
            </Button>
          </div>

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
        </form>
      </FormProvider>
    </div>
  )
}
