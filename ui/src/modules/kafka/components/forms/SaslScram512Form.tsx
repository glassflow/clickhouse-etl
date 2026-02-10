'use client'

import { useFormContext } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
import { useRenderFormFields } from '@/src/components/ui/form'
import { KafkaFormConfig } from '@/src/config/kafka-connection-form-config'
import type { FieldErrors } from 'react-hook-form'
import type { KafkaConnectionFormType } from '@/src/scheme'
import { TruststoreForm } from './TruststoreForm'

export interface AuthFormProps {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}

export function SaslScram512Form({ errors, readOnly }: AuthFormProps) {
  const { register, watch } = useFormContext()
  const securityProtocolSelected = watch('securityProtocol')
  const showTruststoreFields = securityProtocolSelected === 'SASL_SSL' || securityProtocolSelected === 'SSL'

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/SCRAM-512',
        register,
        errors,
        readOnly,
      })}
      {showTruststoreFields && (
        <div className="space-y-4 mt-4">
          <div className="text-sm font-medium text-content">SSL/TLS Configuration</div>
          <TruststoreForm errors={errors} readOnly={readOnly} authMethodPrefix="saslScram512" />
        </div>
      )}
    </FormGroup>
  )
}
