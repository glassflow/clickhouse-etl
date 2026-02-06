'use client'

import { useFormContext } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
import { renderFormField } from '@/src/components/ui/form'
import { KafkaFormConfig } from '@/src/config/kafka-connection-form-config'
import { AUTH_OPTIONS } from '@/src/config/constants'
import type { FieldErrors } from 'react-hook-form'
import type { KafkaConnectionFormType } from '@/src/scheme'
import { TruststoreForm } from './TruststoreForm'

export interface AuthFormProps {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}

export function SaslPlainForm({ errors, readOnly }: AuthFormProps) {
  const { register, watch } = useFormContext()
  const authMethodSelected = watch('authMethod')
  const securityProtocolSelected = watch('securityProtocol')
  const showTruststoreFields =
    authMethodSelected === AUTH_OPTIONS['SASL/PLAIN'].name &&
    (securityProtocolSelected === 'SASL_SSL' || securityProtocolSelected === 'SSL')

  return (
    <FormGroup className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="space-y-2 w-full lg:w-1/2">
          {renderFormField({
            field: KafkaFormConfig[AUTH_OPTIONS['SASL/PLAIN'].name].fields.username as Parameters<typeof renderFormField>[0]['field'],
            register,
            errors,
            readOnly,
          })}
        </div>
        <div className="space-y-2 w-full lg:w-1/2">
          {renderFormField({
            field: KafkaFormConfig[AUTH_OPTIONS['SASL/PLAIN'].name].fields.password as Parameters<typeof renderFormField>[0]['field'],
            register,
            errors,
            readOnly,
          })}
        </div>
      </div>
      {showTruststoreFields && (
        <div className="space-y-4 mt-4">
          <div className="text-sm font-medium text-content">SSL/TLS Configuration</div>
          <TruststoreForm errors={errors} readOnly={readOnly} authMethodPrefix="saslPlain" />
        </div>
      )}
    </FormGroup>
  )
}
