'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/src/components/ui/button'
import { useStore } from '@/src/store'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useClickhouseConnection } from '@/src/hooks/useClickhouseConnection'
import { StepKeys } from '@/src/config/constants'
import { cn } from '@/src/utils/common.client'
import { ClickhouseConnectionFormConfig } from '@/src/config/clickhouse-connection-form-config'
import { renderFormField } from '@/src/components/ui/form'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ClickhouseConnectionFormSchema, ClickhouseConnectionFormType } from '@/src/scheme/clickhouse.scheme'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
import { FormEditActionSet } from '@/src/components/shared/FormEditActionSet'
import FormActionButton from '@/src/components/shared/FormActionButton'

export function ClickhouseConnector({
  onCompleteStep,
  onComplete,
  standalone,
  readOnly = true,
}: {
  onCompleteStep?: (step: StepKeys) => void
  onComplete?: () => void
  standalone?: boolean
  readOnly?: boolean
}) {
  const { clickhouseConnectionStore, clickhouseDestinationStore } = useStore()
  const analytics = useJourneyAnalytics()

  const { clickhouseConnection, setClickhouseConnection } = clickhouseConnectionStore

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
        useSSL: directConnection?.useSSL ?? true,
        skipCertificateVerification: directConnection?.skipCertificateVerification ?? true,
      },
    },
  })

  // Update form values when store changes (for persistence)
  useEffect(() => {
    if (directConnection) {
      formMethod.reset({
        connectionType: 'direct',
        directConnection: {
          host: directConnection.host || '',
          port: directConnection.port || '',
          username: directConnection.username || '',
          password: directConnection.password || '',
          nativePort: directConnection.nativePort || '',
          useSSL: directConnection.useSSL ?? true,
          skipCertificateVerification: directConnection.skipCertificateVerification ?? true,
        },
      })
    }
  }, [directConnection, formMethod])

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

      // First save the connection details to the store
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

      if (result?.success && result.databases?.length > 0) {
        // Track successful connection
        analytics.clickhouse.success({
          host: values.directConnection.host,
          databaseCount: result.databases?.length || 0,
        })

        // Proceed to next step FIXME
        if (!standalone && onCompleteStep) {
          onCompleteStep(StepKeys.CLICKHOUSE_CONNECTION)
        } else if (standalone && onComplete) {
          onComplete()
        }
      } else {
        // Track connection error
        analytics.clickhouse.failed({
          error: result?.error || 'Unknown connection error',
          host: values.directConnection.host,
        })
      }
    },
    [analytics.clickhouse, testConnection, setClickhouseConnection, clickhouseConnection, onCompleteStep],
  )

  return (
    <div className="flex flex-col gap-8">
      <FormProvider {...formMethod}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              {renderFormField({
                field: {
                  ...directConnectionForm.fields.host,
                  readOnly: isLoading,
                },
                register,
                errors,
                readOnly,
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
                readOnly,
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              {renderFormField({
                field: {
                  ...directConnectionForm.fields.username,
                  readOnly: isLoading,
                },
                register,
                errors,
                readOnly,
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
                readOnly,
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              {renderFormField({
                field: {
                  ...directConnectionForm.fields.nativePort,
                  readOnly: isLoading,
                },
                register,
                errors,
                readOnly,
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              {renderFormField({
                // @ts-expect-error - FIXME: fix this later
                field: directConnectionForm.fields.useSSL,
                register,
                errors,
                readOnly,
              })}
            </div>

            <div className="space-y-2">
              {renderFormField({
                // @ts-expect-error - FIXME: fix this later
                field: directConnectionForm.fields.skipCertificateVerification,
                register,
                errors,
                readOnly,
              })}
            </div>
          </div>

          <div className="flex justify-start gap-4 mt-6">
            {/* <Button
              variant={connectionStatus === 'success' ? 'gradient' : 'outline'}
              type="submit"
              disabled={isLoading}
              className={cn('btn-primary', {
                'btn-text-disabled': !connectionStatus,
                'btn-text': connectionStatus,
              })}
            >
              {isLoading ? 'Testing...' : 'Continue'}
            </Button> */}

            {standalone && (
              <FormEditActionSet
                editModeDefault={false}
                onEnableEditMode={() => {}}
                onSaveChanges={() => {}}
                onDiscardChanges={() => {}}
              />
            )}

            {!standalone && (
              <FormActionButton
                onClick={() => {
                  handleSubmit(onSubmit)()
                }}
                isLoading={isLoading}
                isSuccess={connectionStatus === 'success'}
                disabled={isLoading}
                successText="Continue"
                loadingText="Testing..."
                regularText="Continue"
                actionType="primary"
                showLoadingIcon={true}
              />
            )}
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
