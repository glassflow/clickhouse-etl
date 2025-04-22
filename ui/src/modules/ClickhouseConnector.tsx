'use client'

import { useState } from 'react'
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

export function ClickhouseConnectionSetup({ onNext }: { onNext: (step: StepKeys) => void }) {
  const { clickhouseStore } = useStore()
  const { clickhouseConnection, setClickhouseConnection, setAvailableDatabases } = clickhouseStore

  const { directConnection } = clickhouseConnection
  const { directConnectionForm } = ClickhouseConnectionFormConfig

  const formMethod = useForm<ClickhouseConnectionFormType>({
    resolver: zodResolver(ClickhouseConnectionFormSchema),
    defaultValues: {
      connectionType: 'direct',
      directConnection: {
        host: directConnection?.host || '',
        port: directConnection?.port || '8443',
        username: directConnection?.username || '',
        password: directConnection?.password || '',
      },
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = formMethod

  const { isLoading, connectionStatus, connectionError, testConnection } = useClickhouseConnection()

  const onSubmit = async (values: ClickhouseConnectionFormType) => {
    // @ts-expect-error - FIXME: fix this later
    const result = await testConnection(values.directConnection)
    if (result.success) {
      setAvailableDatabases(result.databases)
      saveConnection(values)
    }
  }

  const saveConnection = (formValues: ClickhouseConnectionFormType) => {
    const connector: ClickhouseConnectionFormType = {
      connectionType: 'direct',
      directConnection: {
        host: formValues.directConnection.host,
        port: formValues.directConnection.port,
        username: formValues.directConnection.username,
        password: formValues.directConnection.password,
        nativePort: formValues.directConnection.nativePort,
      },
      connectionStatus: 'success',
      connectionError: null,
    }

    setClickhouseConnection(connector)
    onNext(StepKeys.CLICKHOUSE_CONNECTION)
  }

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
        </form>
      </FormProvider>
    </div>
  )
}
