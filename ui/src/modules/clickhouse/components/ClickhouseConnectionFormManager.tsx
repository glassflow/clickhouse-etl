'use client'

import { useState, useEffect, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
import { StepKeys } from '@/src/config/constants'
import { ClickhouseConnectionFormRenderer } from './ClickhouseConnectionFormRenderer'
import { ClickhouseConnectionFormSchema, ClickhouseConnectionFormType } from '@/src/scheme/clickhouse.scheme'
import FormActionButton from '@/src/components/shared/FormActionButton'
import { FormEditActionButtonGroup } from '@/src/components/shared/FormEditActionButtonGroup'
import FormActions from '@/src/components/shared/FormActions'

type ClickhouseConnectionProps = {
  onTestConnection: (values: ClickhouseConnectionFormType) => Promise<void>
  onDiscardConnectionChange: () => void
  isConnecting: boolean
  connectionResult: {
    success: boolean
    message: string
  } | null
  readOnly?: boolean
  standalone?: boolean
  initialValues: ClickhouseConnectionFormType
  host: string
  httpPort: string
  username: string
  password: string
  nativePort: string
  useSSL: boolean
  skipCertificateVerification: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
  onClose?: () => void
}

export const ClickhouseConnectionFormManager = ({
  onTestConnection,
  onDiscardConnectionChange,
  isConnecting,
  connectionResult,
  readOnly,
  standalone,
  initialValues,
  host,
  httpPort,
  username,
  password,
  nativePort,
  useSSL,
  skipCertificateVerification,
  toggleEditMode,
  pipelineActionState,
  onClose,
}: ClickhouseConnectionProps) => {
  // Create a ref to store the original values for discard functionality
  const originalValuesRef = useRef(initialValues)

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
  const currentPort = watch('directConnection.httpPort')
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

  // Update original values ref when initial values change
  useEffect(() => {
    originalValuesRef.current = initialValues
  }, [initialValues])

  // Initialize form with values from store if returning to the form
  useEffect(() => {
    if (isReturningToForm && !formInitialized.current) {
      // Set form values from existing data
      if (host) setValue('directConnection.host', host)
      if (httpPort) setValue('directConnection.httpPort', httpPort)
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
    httpPort,
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
    if (!isReturningToForm) {
      // For new forms, always ensure defaults are true
      setValue('directConnection.useSSL', true)
      setValue('directConnection.skipCertificateVerification', true)
    }
    // For returning forms, the first effect (lines 99-131) handles value restoration
  }, [setValue, isReturningToForm])

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
      return
    }

    // In standalone mode (both create and edit), always test the connection
    // Only save if the test succeeds
    // The onTestConnection handler will save the data and close the modal on success
    if (standalone) {
      if (onTestConnection) {
        await onTestConnection(values)
        // Note: Don't close here - the success handler in ClickhouseConnectionContainer
        // will save the data and close the modal only if connection test succeeds
      }
      return
    }

    // For non-standalone mode (regular pipeline creation flow)
    if (onTestConnection) {
      await onTestConnection(values)
    }
  }

  const handleDiscard = () => {
    // Reset form to original values from store
    formMethods.reset(originalValuesRef.current)

    // Reset user interaction state
    setUserInteracted(false)

    // Reset form initialization flag to allow re-initialization
    formInitialized.current = false

    // Force re-initialization by setting values manually
    if (host) formMethods.setValue('directConnection.host', host)
    if (httpPort) formMethods.setValue('directConnection.httpPort', httpPort)
    if (username) formMethods.setValue('directConnection.username', username)
    if (password) formMethods.setValue('directConnection.password', password)
    if (nativePort) formMethods.setValue('directConnection.nativePort', nativePort)
    if (useSSL !== undefined) formMethods.setValue('directConnection.useSSL', useSSL)
    if (skipCertificateVerification !== undefined)
      formMethods.setValue('directConnection.skipCertificateVerification', skipCertificateVerification)

    onDiscardConnectionChange()
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

        <FormActions
          standalone={standalone}
          onSubmit={submitFormValues}
          onDiscard={handleDiscard}
          toggleEditMode={toggleEditMode}
          readOnly={readOnly}
          isLoading={
            isConnecting ||
            (pipelineActionState?.isLoading &&
              (pipelineActionState?.lastAction === 'stop' || pipelineActionState?.lastAction === 'edit'))
          }
          isSuccess={connectionResult?.success}
          disabled={
            isConnecting ||
            (pipelineActionState?.isLoading &&
              (pipelineActionState?.lastAction === 'stop' || pipelineActionState?.lastAction === 'edit'))
          }
          successText="Continue"
          loadingText={
            pipelineActionState?.isLoading && pipelineActionState?.lastAction === 'stop'
              ? 'Stopping pipeline for editing...'
              : pipelineActionState?.isLoading && pipelineActionState?.lastAction === 'edit'
                ? 'Saving configuration...'
                : 'Testing...'
          }
          regularText="Continue"
          actionType="primary"
          showLoadingIcon={true}
          pipelineActionState={pipelineActionState}
          onClose={onClose}
        />
      </form>
    </FormProvider>
  )
}
