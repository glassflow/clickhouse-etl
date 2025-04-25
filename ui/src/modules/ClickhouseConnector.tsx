'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { useAnalytics } from '@/src/hooks/useAnalytics'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useClickhouseConnection } from '@/src/hooks/clickhouse-mng-hooks'
import { StepKeys } from '@/src/config/constants'
import { cn } from '@/src/utils'
import { ClickhouseConnectionFormConfig } from '@/src/config/clickhouse-connection-form-config'
import { renderFormField } from '@/src/components/ui/form'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ClickhouseConnectionFormSchema, ClickhouseConnectionFormType } from '@/src/scheme/clickhouse.scheme'

export function ClickhouseConnectionSetup({ onNext }: { onNext: (step: StepKeys) => void }) {
  const { clickhouseStore } = useStore()
  const { trackFunnelStep, trackError, trackFeatureUsage } = useAnalytics()
  const { clickhouseConnection, setClickhouseConnection, setAvailableDatabases } = clickhouseStore
  const [hasInteracted, setHasInteracted] = useState(false)
  const [hasTrackedView, setHasTrackedView] = useState(false)

  const { directConnection } = clickhouseConnection
  const { directConnectionForm } = ClickhouseConnectionFormConfig

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
      trackFunnelStep('clickhouseConnectionView', {
        isReturningVisit: !!directConnection?.host,
      })
      setHasTrackedView(true)
    }
  }, [hasTrackedView, trackFunnelStep, directConnection?.host])

  // Track when user interacts with the form
  useEffect(() => {
    if (isDirty && !hasInteracted) {
      trackFunnelStep('clickhouseConnectionStarted', {
        isReturningVisit: !!directConnection?.host,
      })
      setHasInteracted(true)
    }
  }, [isDirty, hasInteracted, trackFunnelStep, directConnection?.host])

  // const useSSL = watch('directConnection.useSSL')
  // useEffect(() => {
  //   setValue('directConnection.nativePort', useSSL ? '9440' : '8443')
  // }, [useSSL])

  useEffect(() => {
    setValue('directConnection.useSSL', true)
  }, [setValue])

  const { isLoading, connectionStatus, connectionError, testConnection } = useClickhouseConnection()

  const onSubmit = useCallback(
    async (values: ClickhouseConnectionFormType) => {
      // Track connection attempt
      trackFunnelStep('clickhouseConnectionAttempted', {
        host: values.directConnection.host,
        useSSL: values.directConnection.useSSL,
      })

      // @ts-expect-error - FIXME: fix this later
      const result = await testConnection(values.directConnection)
      console.log('result - clickhouse:', result)
      if (result.success && result.databases.length > 0) {
        console.log('result - clickhouse - success:', result)
        console.log('result - clickhouse - databases:', result.databases)
        // Track successful connection
        trackFunnelStep('clickhouseConnectionSucceeded', {
          host: values.directConnection.host,
          databaseCount: result.databases?.length || 0,
        })

        setAvailableDatabases(result.databases)
        saveConnection(values)
      } else {
        // Track connection error
        trackError('connection', {
          component: 'ClickhouseConnector',
          error: result.error || 'Unknown connection error',
          host: values.directConnection.host,
        })
      }
    },
    [trackFunnelStep, trackError, testConnection, setAvailableDatabases],
  )

  const saveConnection = useCallback(
    (formValues: ClickhouseConnectionFormType) => {
      const connector: ClickhouseConnectionFormType = {
        connectionType: 'direct',
        directConnection: {
          host: formValues.directConnection.host,
          port: formValues.directConnection.port,
          username: formValues.directConnection.username,
          password: formValues.directConnection.password,
          nativePort: formValues.directConnection.nativePort,
          useSSL: formValues.directConnection.useSSL,
        },
        connectionStatus: 'success',
        connectionError: null,
      }

      // Track SSL usage as a feature
      if (formValues.directConnection.useSSL) {
        trackFeatureUsage('ssl', {
          component: 'ClickhouseConnector',
          enabled: true,
        })
      }

      setClickhouseConnection(connector)
      onNext(StepKeys.CLICKHOUSE_CONNECTION)
    },
    [setClickhouseConnection, onNext, trackFeatureUsage],
  )

  return (
    <div className="flex flex-col gap-8">
      <FormProvider {...formMethod}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {renderFormField({
                field: directConnectionForm.fields.host,
                register,
                errors,
              })}
            </div>

            <div className="space-y-2">
              {renderFormField({
                field: directConnectionForm.fields.port,
                register,
                errors,
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {renderFormField({
                field: directConnectionForm.fields.username,
                register,
                errors,
              })}
            </div>

            <div className="space-y-2">
              {renderFormField({
                field: directConnectionForm.fields.password,
                register,
                errors,
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {renderFormField({
                field: directConnectionForm.fields.nativePort,
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
