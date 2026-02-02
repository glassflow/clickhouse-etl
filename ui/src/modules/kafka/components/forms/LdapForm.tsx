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

export function LdapForm({ errors, readOnly }: AuthFormProps) {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/LDAP',
        register,
        errors,
        readOnly,
      })}
    </FormGroup>
  )
}
