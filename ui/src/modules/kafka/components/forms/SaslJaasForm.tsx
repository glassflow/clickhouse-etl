'use client'

import { useFormContext } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
import { useRenderFormFields } from '@/src/components/ui/form'
import { KafkaFormConfig } from '@/src/config/kafka-connection-form-config'
import type { FieldErrors } from 'react-hook-form'
import type { KafkaConnectionFormType } from '@/src/scheme'

export interface AuthFormProps {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}

export function SaslJaasForm({ errors, readOnly }: AuthFormProps) {
  const { register } = useFormContext()

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/JAAS',
        register,
        errors,
        readOnly,
      })}
    </FormGroup>
  )
}
