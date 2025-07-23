'use client'

import { useState, useEffect, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
import { ZodSchema } from 'zod'
import { useJourneyAnalytics } from '@/src/hooks/useJourneyAnalytics'

interface FormConfig {
  defaultValues: any
  validationSchema: ZodSchema
  fields: Record<string, any>
}

interface ConnectionFormManagerProps {
  formConfig: FormConfig
  onComplete: (data: any) => void
  onTestConnection: (data: any) => Promise<boolean>
  readOnly?: boolean
  standalone?: boolean
  initialData?: any
  stepType: string
  children: React.ReactNode
}

export function ConnectionFormManager({
  formConfig,
  onComplete,
  onTestConnection,
  readOnly = false,
  standalone = false,
  initialData,
  stepType,
  children,
}: ConnectionFormManagerProps) {
  const analytics = useJourneyAnalytics()
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [userInteracted, setUserInteracted] = useState(false)
  const formInitialized = useRef(false)
  const [hasTrackedInitialInteraction, setHasTrackedInitialInteraction] = useState(false)

  // Prepare initial values by merging defaults with provided data
  const initialValues = {
    ...formConfig.defaultValues,
    ...initialData,
  }

  const formMethods = useForm({
    resolver: zodResolver(formConfig.validationSchema),
    defaultValues: initialValues,
    mode: 'onBlur',
    criteriaMode: 'firstError',
    shouldFocusError: false,
  })

  const { watch, setValue, trigger, handleSubmit } = formMethods
  const { errors, isValid, isDirty, touchedFields } = formMethods.formState

  // Handle form field changes
  const handleFormChange = () => {
    if (!userInteracted) {
      setUserInteracted(true)
    }

    // Track the first interaction with the connection form
    if (!hasTrackedInitialInteraction) {
      setHasTrackedInitialInteraction(true)
      analytics.connection.firstInteraction({ stepType })
    }
  }

  const submitForm = () => {
    handleSubmit(onSubmit)()
  }

  // Initialize form with values from initialData if provided
  useEffect(() => {
    if (initialData && !formInitialized.current) {
      // Set form values from existing data
      Object.entries(initialData).forEach(([key, value]) => {
        if (value !== undefined) {
          setValue(key, value)
        }
      })
      formInitialized.current = true
    }

    // Mark that we're no longer on initial render after the first effect run
    return () => {
      if (isInitialRender) {
        setIsInitialRender(false)
      }
    }
  }, [initialData, setValue, isInitialRender])

  // Determine if we should show validation errors
  const shouldShowValidationErrors =
    userInteracted || (initialData && !isInitialRender && Object.keys(touchedFields).length > 0)

  const onSubmit = (values: any) => {
    // Track successful form submission
    analytics.connection.formSubmitted({
      stepType,
      hasErrors: Object.keys(errors).length > 0,
    })

    onComplete(values)
  }

  const testConnection = async () => {
    const values = formMethods.getValues()

    // Mark that user has interacted with the form
    setUserInteracted(true)

    // Manually trigger validation
    const result = await formMethods.trigger()

    if (!result) {
      console.log('Form has validation errors', formMethods.formState.errors)
      return
    }

    // Track attempt to test connection
    analytics.connection.testStarted({
      stepType,
      hasErrors: Object.keys(errors).length > 0,
    })

    onTestConnection(values)
  }

  return (
    <FormProvider {...formMethods}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
        onChange={handleFormChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
          }
        }}
      >
        {children}
      </form>
    </FormProvider>
  )
}
