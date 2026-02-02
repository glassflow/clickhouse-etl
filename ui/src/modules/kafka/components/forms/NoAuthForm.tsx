'use client'

import { useFormContext } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
import { AUTH_OPTIONS } from '@/src/config/constants'
import type { FieldErrors } from 'react-hook-form'
import type { KafkaConnectionFormType } from '@/src/scheme'
import { TruststoreForm } from './TruststoreForm'

export interface AuthFormProps {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}

export function NoAuthForm({ errors, readOnly }: AuthFormProps) {
  const { watch } = useFormContext()
  const authMethodSelected = watch('authMethod')
  const securityProtocolSelected = watch('securityProtocol')
  const showSSLFields =
    authMethodSelected === AUTH_OPTIONS['NO_AUTH'].name &&
    (securityProtocolSelected === 'SASL_SSL' || securityProtocolSelected === 'SSL')

  return (
    <FormGroup className="space-y-4">
      {showSSLFields && (
        <div className="space-y-4">
          <div className="text-sm font-medium text-content">SSL/TLS Configuration</div>
          <TruststoreForm errors={errors} readOnly={readOnly} authMethodPrefix="noAuth" />
        </div>
      )}
    </FormGroup>
  )
}
