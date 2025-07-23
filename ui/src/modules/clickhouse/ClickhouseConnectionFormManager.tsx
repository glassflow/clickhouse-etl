'use client'

import { useState, useEffect, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
import { StepKeys } from '@/src/config/constants'
import { ClickhouseConnectionFormRenderer } from './ClickhouseConnectionFormRenderer'
import { ClickhouseConnectionFormSchema, ClickhouseConnectionFormType } from '@/src/scheme/clickhouse.scheme'
import FormActionButton from '@/src/components/shared/FormActionButton'
import { FormEditActionSet } from '@/src/components/shared/FormEditActionSet'

type ClickhouseConnectionProps = {
  onTestConnection: (values: ClickhouseConnectionFormType) => Promise<void>
  isConnecting: boolean
  connectionResult: {
    success: boolean
    message: string
  } | null
  readOnly?: boolean
  standalone?: boolean
  initialValues: ClickhouseConnectionFormType
  host: string
  port: string
  username: string
  password: string
  nativePort: string
  useSSL: boolean
  skipCertificateVerification: boolean
}

export const ClickhouseConnectionFormManager = ({
  onTestConnection,
  isConnecting,
  connectionResult,
  readOnly,
  standalone,
  initialValues,
  host,
  port,
  username,
  password,
  nativePort,
  useSSL,
  skipCertificateVerification,
}: ClickhouseConnectionProps) => {
  // Track if this is the initial render or a return visit
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [userInteracted, setUserInteracted] = useState(false)
  const formInitialized = useRef(false)

  // Check if we're returning to a previously filled form
  const isReturningToForm = !!host

  const formMethods = useForm<ClickhouseConnectionFormType>({
    resolver: zodResolver(ClickhouseConnectionFormSchema),
    defaultValues: initialValues,
    mode: 'onBlur',
    criteriaMode: 'firstError',
    shouldFocusError: false,
  })

  const { watch, setValue, trigger, handleSubmit } = formMethods
  const { errors, isValid, isDirty, touchedFields } = formMethods.formState

  // Watch for changes to form fields
  const currentHost = watch('directConnection.host')
  const currentPort = watch('directConnection.port')
  const currentUsername = watch('directConnection.username')
  const currentPassword = watch('directConnection.password')
  const currentNativePort = watch('directConnection.nativePort')
  const currentUseSSL = watch('directConnection.useSSL')
  const currentSkipCertificateVerification = watch('directConnection.skipCertificateVerification')

  // Handle form field changes
  const handleFormChange = () => {
    if (!userInteracted) {
      setUserInteracted(true)
    }
  }

  // Initialize form with values from store if returning to the form
  useEffect(() => {
    if (isReturningToForm && !formInitialized.current) {
      // Set form values from existing data
      if (host) setValue('directConnection.host', host)
      if (port) setValue('directConnection.port', port)
      if (username) setValue('directConnection.username', username)
      if (password) setValue('directConnection.password', password)
      if (nativePort) setValue('directConnection.nativePort', nativePort)
      if (useSSL !== undefined) setValue('directConnection.useSSL', useSSL)
      if (skipCertificateVerification !== undefined)
        setValue('directConnection.skipCertificateVerification', skipCertificateVerification)

      formInitialized.current = true
    }

    // Mark that we're no longer on initial render after the first effect run
    return () => {
      if (isInitialRender) {
        setIsInitialRender(false)
      }
    }
  }, [
    host,
    port,
    username,
    password,
    nativePort,
    useSSL,
    skipCertificateVerification,
    setValue,
    isInitialRender,
    isReturningToForm,
  ])

  // Set default values for useSSL and skipCertificateVerification
  useEffect(() => {
    setValue('directConnection.useSSL', true)
    setValue('directConnection.skipCertificateVerification', true)
  }, [setValue])

  // Determine if we should show validation errors - only if user has interacted with the form
  // or explicitly returning to a previously valid form
  const shouldShowValidationErrors =
    userInteracted || (isReturningToForm && !isInitialRender && Object.keys(touchedFields).length > 0)

  const submitFormValues = async () => {
    // get the values from the form
    const values = formMethods.getValues()

    // Mark that user has interacted with the form
    setUserInteracted(true)

    // Manually trigger validation now that the user has explicitly requested it
    const result = await formMethods.trigger()

    // early return if there are validation errors
    if (!result) {
      console.log('Form has validation errors', formMethods.formState.errors)
      return
    }

    if (onTestConnection) {
      onTestConnection(values)
    }
  }

  return (
    <FormProvider {...formMethods}>
      <form
        onSubmit={handleSubmit(() => {})}
        className="space-y-6"
        onChange={handleFormChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
          }
        }}
      >
        <ClickhouseConnectionFormRenderer
          errors={shouldShowValidationErrors ? errors : {}}
          readOnly={readOnly}
          isLoading={isConnecting}
        />

        <div className="flex gap-4">
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
              onClick={submitFormValues}
              isLoading={isConnecting}
              isSuccess={connectionResult?.success}
              disabled={isConnecting}
              successText="Continue"
              loadingText="Testing..."
              regularText="Continue"
              actionType="primary"
              showLoadingIcon={true}
            />
          )}
        </div>
      </form>
    </FormProvider>
  )
}
