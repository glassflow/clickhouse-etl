'use client'

import { useState, useEffect, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { useForm, FormProvider } from 'react-hook-form'
import { Alert, AlertDescription } from '@/src/components/ui/'
import { AUTH_OPTIONS, StepKeys } from '@/src/config/constants'
import { KafkaFormDefaultValues } from '@/src/config/kafka-connection-form-config'
import { KafkaAuthForm } from './KafkaAuthForms'
import { KafkaConnectionFormSchema, KafkaConnectionFormType } from '@/src/scheme'
import classnames from 'classnames'

type KafkaConnectionProps = {
  onTestConnection: (values: KafkaConnectionFormType) => Promise<boolean>
  isConnecting: boolean
  connectionResult: {
    success: boolean
    message: string
  } | null
  onNext: (step: StepKeys) => void
}

export const KafkaConnectionForm = ({
  onTestConnection,
  isConnecting,
  connectionResult,
  onNext,
}: KafkaConnectionProps) => {
  const { kafkaStore } = useStore()
  const {
    setKafkaAuthMethod,
    setKafkaSecurityProtocol,
    setKafkaBootstrapServers,
    setKafkaSaslPlain,
    setKafkaSaslJaas,
    setKafkaSaslGssapi,
    setKafkaSaslOauthbearer,
    setKafkaSaslScram256,
    setKafkaSaslScram512,
    setKafkaDelegationTokens,
    setKafkaConnection,
    isConnected,
    authMethod,
    securityProtocol,
    bootstrapServers,
    saslPlain,
    saslJaas,
    saslGssapi,
    saslOauthbearer,
    saslScram256,
    saslScram512,
    delegationTokens,
  } = kafkaStore

  // Track if this is the initial render or a return visit
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [userInteracted, setUserInteracted] = useState(false)
  const formInitialized = useRef(false)

  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check if we're returning to a previously filled form
  const isReturningToForm = !!bootstrapServers

  // Prepare initial values by merging defaults with store values
  const initialValues = {
    ...KafkaFormDefaultValues,
    authMethod: authMethod || KafkaFormDefaultValues.authMethod,
    securityProtocol: securityProtocol || KafkaFormDefaultValues.securityProtocol,
    bootstrapServers: bootstrapServers || KafkaFormDefaultValues.bootstrapServers,
    // saslPlain: saslPlain || KafkaFormDefaultValues.saslPlain,
    // saslJaas: saslJaas || KafkaFormDefaultValues.saslJaas,
    // saslGssapi: saslGssapi || KafkaFormDefaultValues.saslGssapi,
    // saslOauthbearer: saslOauthbearer || KafkaFormDefaultValues.saslOauthbearer,
    // saslScram256: saslScram256 || KafkaFormDefaultValues.saslScram256,
    // saslScram512: saslScram512 || KafkaFormDefaultValues.saslScram512,
    // delegationTokens: delegationTokens || KafkaFormDefaultValues.delegationToken,
  }

  const formMethods = useForm<KafkaConnectionFormType>({
    resolver: zodResolver(KafkaConnectionFormSchema),
    // @ts-expect-error - FIXME: fix this later
    defaultValues: initialValues,
    mode: 'onChange',
  })

  const { watch, setValue, trigger, handleSubmit } = formMethods
  const { errors, isValid } = formMethods.formState

  // Watch for changes to auth method and security protocol
  const currentAuthMethod = watch('authMethod')
  const currentSecurityProtocol = watch('securityProtocol')

  // Handle form field changes
  const handleFormChange = () => {
    setUserInteracted(true)
  }

  const submitForm = () => {
    // @ts-expect-error - FIXME: fix this later
    handleSubmit(onSubmit)()
  }

  useEffect(() => {
    if (connectionResult?.success) {
      setTestStatus('success')

      submitForm()
    }
  }, [connectionResult])

  // Initialize form with values from store if returning to the form
  useEffect(() => {
    if (isReturningToForm && !formInitialized.current) {
      // Set form values from existing data
      if (authMethod) setValue('authMethod', authMethod as KafkaConnectionFormType['authMethod'])
      if (securityProtocol)
        setValue('securityProtocol', securityProtocol as KafkaConnectionFormType['securityProtocol'])
      if (bootstrapServers)
        setValue('bootstrapServers', bootstrapServers as KafkaConnectionFormType['bootstrapServers'])

      // Only trigger validation if returning to a previously filled form
      if (!isInitialRender) {
        trigger()
      }

      formInitialized.current = true
    }

    // Only trigger validation if returning to a previously filled form
    if (!isInitialRender) {
      trigger()
    }

    // Mark that we're no longer on initial render after the first effect run
    return () => {
      if (isInitialRender) {
        setIsInitialRender(false)
      }
    }
  }, [authMethod, securityProtocol, bootstrapServers, setValue, trigger, isInitialRender, isReturningToForm])

  // Determine if we should show validation errors
  const shouldShowValidationErrors = userInteracted || !isInitialRender || isReturningToForm

  const onSubmit = (values: KafkaConnectionFormType) => {
    const { authMethod, securityProtocol, bootstrapServers } = values
    setKafkaAuthMethod(authMethod)
    setKafkaSecurityProtocol(securityProtocol)
    setKafkaBootstrapServers(bootstrapServers)

    // Set the appropriate auth form based on auth method
    if (values.authMethod === AUTH_OPTIONS['SASL/PLAIN'].name) {
      setKafkaSaslPlain({
        // @ts-expect-error - FIXME: fix this later
        ...values.saslPlain,
      })
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/JAAS'].name) {
      setKafkaSaslJaas({
        // @ts-expect-error - FIXME: fix this later
        ...values.saslJaas,
      })
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/GSSAPI'].name) {
      setKafkaSaslGssapi({
        // @ts-expect-error - FIXME: fix this later
        ...values.saslGssapi,
      })
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/OAUTHBEARER'].name) {
      setKafkaSaslOauthbearer({
        // @ts-expect-error - FIXME: fix this later
        ...values.saslOauthbearer,
      })
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/SCRAM-256'].name) {
      setKafkaSaslScram256({
        // @ts-expect-error - FIXME: fix this later
        ...values.saslScram256,
      })
    }

    if (values.authMethod === AUTH_OPTIONS['SASL/SCRAM-512'].name) {
      setKafkaSaslScram512({
        // @ts-expect-error - FIXME: fix this later
        ...values.saslScram512,
      })
    }

    if (values.authMethod === AUTH_OPTIONS['Delegation tokens'].name) {
      setKafkaDelegationTokens({
        // @ts-expect-error - FIXME: fix this later
        ...values.delegationTokens,
      })
    }

    if (onNext) {
      onNext(StepKeys.KAFKA_CONNECTION)
    }
  }

  const testConnection = async () => {
    const values = formMethods.getValues()

    // Mark that user has interacted with the form
    setUserInteracted(true)

    const result = await formMethods.trigger()

    if (!result) {
      console.log('form has validation errors', formMethods.formState.errors)
      return
    }

    setKafkaConnection({
      ...values,
      bootstrapServers: values.bootstrapServers,
      isConnected: true,
    })

    if (onTestConnection) {
      onTestConnection(values)
    }

    setTestStatus('loading')
  }

  return (
    <FormProvider {...formMethods}>
      {/* @ts-expect-error - FIXME: fix this later */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" onChange={handleFormChange}>
        <KafkaAuthForm
          authMethod={currentAuthMethod}
          securityProtocol={currentSecurityProtocol}
          errors={shouldShowValidationErrors ? errors : {}}
        />

        {testStatus === 'success' && (
          <Alert className="bg-green-50 border-green-500 text-green-700">
            <AlertDescription>Successfully connected to Kafka cluster!</AlertDescription>
          </Alert>
        )}

        {testStatus === 'error' && (
          <Alert className="bg-red-50 border-red-500 text-red-700">
            <AlertDescription>Failed to connect to Kafka cluster. Please check your credentials.</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-4">
          <Button
            className={classnames({
              'btn-primary': connectionResult?.success,
              'btn-text': true,
              'opacity-50': isConnecting,
            })}
            type="button"
            variant="gradient"
            size="custom"
            onClick={testConnection}
            disabled={isConnecting}
          >
            {isConnecting ? 'Loading...' : 'Continue'}
          </Button>
          {/* <Button
            type="submit"
            disabled={!connectionResult?.success || !isConnected}
            variant={connectionResult?.success ? 'gradient' : 'outline'}
            className={classnames({
              'btn-primary': connectionResult?.success,
              'btn-text-disabled': !connectionResult?.success,
              'btn-text': connectionResult?.success,
            })}
          >
            Continue
          </Button> */}
        </div>
      </form>
    </FormProvider>
  )
}
