'use client'

import { useState, useEffect, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
import { KafkaConnectionFormRenderer } from './KafkaConnectionFormRenderer'
import { KafkaConnectionFormSchema, KafkaConnectionFormType } from '@/src/scheme'
import FormActions from '@/src/components/shared/FormActions'
import { useStore } from '@/src/store'

type KafkaConnectionProps = {
  onTestConnection: (values: KafkaConnectionFormType) => Promise<void>
  onDiscardConnectionChange: () => void
  isConnecting: boolean
  connectionResult: {
    success: boolean
    message: string
  } | null
  readOnly?: boolean
  standalone?: boolean
  initialValues: KafkaConnectionFormType
  authMethod: string
  securityProtocol: string
  bootstrapServers: string
  toggleEditMode?: (apiConfig?: any) => void
  pipelineActionState?: any
  onClose?: () => void
}

export const KafkaConnectionFormManager = ({
  onTestConnection,
  onDiscardConnectionChange,
  isConnecting,
  connectionResult,
  readOnly,
  standalone,
  initialValues,
  authMethod,
  securityProtocol,
  bootstrapServers,
  toggleEditMode,
  pipelineActionState,
  onClose,
}: KafkaConnectionProps) => {
  // Create a ref to store the original values for discard functionality
  const originalValuesRef = useRef(initialValues)
  // Track if this is the initial render or a return visit
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [userInteracted, setUserInteracted] = useState(false)
  const formInitialized = useRef(false)

  // Check if we're returning to a previously filled form
  const isReturningToForm = !!bootstrapServers

  const formMethods = useForm<KafkaConnectionFormType>({
    resolver: zodResolver(KafkaConnectionFormSchema),
    defaultValues: initialValues,
    mode: 'onBlur',
    criteriaMode: 'firstError',
    shouldFocusError: false,
  })

  const { watch, setValue, trigger, handleSubmit } = formMethods
  const { errors, isValid, isDirty, touchedFields } = formMethods.formState

  // Watch for changes to auth method and security protocol
  const currentAuthMethod = watch('authMethod')
  const currentSecurityProtocol = watch('securityProtocol')

  // Auto-select security protocol based on auth method
  useEffect(() => {
    if (currentAuthMethod) {
      if (currentAuthMethod === 'SASL/SCRAM-256' || currentAuthMethod === 'SASL/SCRAM-512') {
        setValue('securityProtocol', 'SASL_SSL')
      } else if (currentAuthMethod === 'SASL/PLAIN') {
        setValue('securityProtocol', 'SASL_PLAINTEXT')
      } else if (currentAuthMethod === 'NO_AUTH') {
        setValue('securityProtocol', 'PLAINTEXT')
      } else if (currentAuthMethod === 'SASL/JAAS') {
        setValue('securityProtocol', 'SASL_JAAS')
      } else if (currentAuthMethod === 'SASL/GSSAPI') {
        setValue('securityProtocol', 'SASL_GSSAPI')
      }
    }
  }, [currentAuthMethod, setValue])

  // Handle form field changes
  const handleFormChange = () => {
    if (!userInteracted) {
      setUserInteracted(true)
    }
  }

  // Update original values ref when store values change
  useEffect(() => {
    originalValuesRef.current = initialValues
  }, [initialValues])

  // Initialize form with values from store if returning to the form
  useEffect(() => {
    if (isReturningToForm && !formInitialized.current) {
      // Set form values from existing data
      if (authMethod) {
        setValue('authMethod', authMethod as KafkaConnectionFormType['authMethod'])
      }

      if (securityProtocol) {
        setValue('securityProtocol', securityProtocol as KafkaConnectionFormType['securityProtocol'])
      }

      if (bootstrapServers) {
        setValue('bootstrapServers', bootstrapServers as KafkaConnectionFormType['bootstrapServers'])
      }

      // Only manually trigger validation if returning to a form with stored values
      // and only after the user has explicitly interacted with it
      formInitialized.current = true
    }

    // Remove automatic validation trigger

    // Mark that we're no longer on initial render after the first effect run
    return () => {
      if (isInitialRender) {
        setIsInitialRender(false)
      }
    }
  }, [authMethod, securityProtocol, bootstrapServers, setValue, isInitialRender, isReturningToForm])

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

    // In standalone mode (both create and edit), always test the connection
    // Only save if the test succeeds
    // The onTestConnection handler will save the data and close the modal on success
    if (standalone) {
      if (onTestConnection) {
        await onTestConnection(values)
        // Note: Don't close here - the success handler in KafkaConnectionContainer
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
    if (authMethod) {
      formMethods.setValue('authMethod', authMethod as KafkaConnectionFormType['authMethod'])
    }
    if (securityProtocol) {
      formMethods.setValue('securityProtocol', securityProtocol as KafkaConnectionFormType['securityProtocol'])
    }
    if (bootstrapServers) {
      formMethods.setValue('bootstrapServers', bootstrapServers as KafkaConnectionFormType['bootstrapServers'])
    }

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
        <KafkaConnectionFormRenderer
          authMethod={currentAuthMethod}
          securityProtocol={currentSecurityProtocol}
          errors={shouldShowValidationErrors ? errors : {}}
          readOnly={readOnly}
        />

        <FormActions
          onSubmit={submitFormValues}
          onDiscard={handleDiscard}
          toggleEditMode={toggleEditMode}
          standalone={standalone}
          readOnly={readOnly}
          disabled={
            isConnecting ||
            (pipelineActionState?.isLoading &&
              (pipelineActionState?.lastAction === 'stop' || pipelineActionState?.lastAction === 'edit'))
          }
          isLoading={
            isConnecting ||
            (pipelineActionState?.isLoading &&
              (pipelineActionState?.lastAction === 'stop' || pipelineActionState?.lastAction === 'edit'))
          }
          isSuccess={connectionResult?.success}
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
