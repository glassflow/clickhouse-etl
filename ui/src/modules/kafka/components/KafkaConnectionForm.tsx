'use client'

import { useState, useEffect, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useStore } from '@/src/store'
import { Button } from '@/src/components/ui/button'
import { useForm, FormProvider } from 'react-hook-form'
import { AUTH_OPTIONS, StepKeys } from '@/src/config/constants'
import { KafkaFormDefaultValues } from '@/src/config/kafka-connection-form-config'
import { KafkaAuthForm } from './KafkaAuthForms'
import { KafkaConnectionFormSchema, KafkaConnectionFormType } from '@/src/scheme'
import { cn } from '@/src/utils'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'
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
  const analytics = useJourneyAnalytics()
  const {
    setKafkaAuthMethod,
    setKafkaSecurityProtocol,
    setKafkaBootstrapServers,
    setKafkaNoAuth,
    setKafkaSaslPlain,
    setKafkaSaslJaas,
    setKafkaSaslGssapi,
    setKafkaSaslOauthbearer,
    setKafkaSaslScram256,
    setKafkaSaslScram512,
    setKafkaDelegationTokens,
    setKafkaConnection,
    setKafkaSkipAuth,
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
    noAuth,
  } = kafkaStore

  // Track if this is the initial render or a return visit
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [userInteracted, setUserInteracted] = useState(false)
  const formInitialized = useRef(false)
  const [hasTrackedInitialInteraction, setHasTrackedInitialInteraction] = useState(false)

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
    saslPlain: saslPlain || KafkaFormDefaultValues.saslPlain,
    noAuth: noAuth || KafkaFormDefaultValues.noAuth,
    // saslJaas: saslJaas || KafkaFormDefaultValues.saslJaas,
    // saslGssapi: saslGssapi || KafkaFormDefaultValues.saslGssapi,
    // saslOauthbearer: saslOauthbearer || KafkaFormDefaultValues.saslOauthbearer,
    saslScram256: saslScram256 || KafkaFormDefaultValues.saslScram256,
    saslScram512: saslScram512 || KafkaFormDefaultValues.saslScram512,
    // delegationTokens: delegationTokens || KafkaFormDefaultValues.delegationToken,
  }

  const formMethods = useForm<KafkaConnectionFormType>({
    resolver: zodResolver(KafkaConnectionFormSchema),
    // @ts-expect-error - FIXME: fix this later
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

  // Handle form field changes
  const handleFormChange = () => {
    if (!userInteracted) {
      setUserInteracted(true)
    }

    // Track the first interaction with the Kafka connection form
    if (!hasTrackedInitialInteraction) {
      setHasTrackedInitialInteraction(true)
    }
  }

  const submitForm = () => {
    // @ts-expect-error - FIXME: fix this later
    handleSubmit(onSubmit)()
  }

  useEffect(() => {
    if (connectionResult) {
      if (connectionResult.success) {
        setTestStatus('success')

        // Track successful Kafka connection
        analytics.kafka.success({
          authMethod: currentAuthMethod,
          securityProtocol: currentSecurityProtocol,
          connectionTime: isConnecting ? Date.now() : undefined,
        })

        submitForm()
      } else {
        setTestStatus('error')

        // Track failed Kafka connection
        analytics.kafka.failed({
          authMethod: currentAuthMethod,
          securityProtocol: currentSecurityProtocol,
          error: connectionResult.message,
        })
      }
    }
  }, [connectionResult, currentAuthMethod, currentSecurityProtocol, isConnecting, analytics.kafka])

  // Initialize form with values from store if returning to the form
  useEffect(() => {
    if (isReturningToForm && !formInitialized.current) {
      // Set form values from existing data
      if (authMethod) setValue('authMethod', authMethod as KafkaConnectionFormType['authMethod'])
      if (securityProtocol)
        setValue('securityProtocol', securityProtocol as KafkaConnectionFormType['securityProtocol'])
      if (bootstrapServers)
        setValue('bootstrapServers', bootstrapServers as KafkaConnectionFormType['bootstrapServers'])

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

  const onSubmit = (values: KafkaConnectionFormType) => {
    const { authMethod, securityProtocol, bootstrapServers } = values
    setKafkaAuthMethod(authMethod)
    setKafkaSecurityProtocol(securityProtocol)
    setKafkaBootstrapServers(bootstrapServers)

    if (authMethod === AUTH_OPTIONS['NO_AUTH'].name) {
      setKafkaSkipAuth(true)
      setKafkaNoAuth({
        // @ts-expect-error - FIXME: fix this later
        ...values.noAuth,
      })
    } else {
      setKafkaSkipAuth(false)
      setKafkaNoAuth({
        certificate: '',
      })
    }

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

    // Manually trigger validation now that the user has explicitly requested it
    const result = await formMethods.trigger()

    if (!result) {
      console.log('Form has validation errors', formMethods.formState.errors)
      return
    }

    setKafkaConnection({
      ...values,
      bootstrapServers: values.bootstrapServers,
      isConnected: true,
    })

    if (onTestConnection) {
      // Track attempt to test connection
      analytics.kafka.started({
        authMethod: values.authMethod,
        securityProtocol: values.securityProtocol,
      })

      onTestConnection(values)
    }

    setTestStatus('loading')
  }

  return (
    <FormProvider {...formMethods}>
      <form
        onSubmit={handleSubmit(onSubmit as any)}
        className="space-y-6"
        onChange={handleFormChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
          }
        }}
      >
        <KafkaAuthForm
          authMethod={currentAuthMethod}
          securityProtocol={currentSecurityProtocol}
          errors={shouldShowValidationErrors ? errors : {}}
        />

        <div className="flex gap-4">
          <Button
            className={cn({
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
        </div>
      </form>
    </FormProvider>
  )
}
