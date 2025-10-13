import { useFormContext } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
import { renderFormField } from '@/src/components/ui/form'
import { KafkaBaseFormConfig } from '@/src/config/kafka-connection-form-config'
import { FieldErrors } from 'react-hook-form'
import { KafkaConnectionFormType } from '@/src/scheme'
import { AUTH_OPTIONS } from '@/src/config/constants'
import { useEffect, useState } from 'react'
import { SECURITY_PROTOCOL_OPTIONS_SASL, SECURITY_PROTOCOL_OPTIONS } from '@/src/config/constants'
import {
  SaslPlainForm,
  NoAuthForm,
  SaslJaasForm,
  SaslGssapiForm,
  SaslOauthbearerForm,
  SaslScram256Form,
  SaslScram512Form,
  AwsIamForm,
  MtlsForm,
  DelegationTokensForm,
  LdapForm,
  TruststoreForm,
} from './form-variants'

// Base form - mandatory fields - always present in the form
const KafkaBaseForm = ({
  errors,
  authMethod,
  readOnly,
  securityProtocolOptions,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  authMethod: string
  readOnly?: boolean
  securityProtocolOptions: Array<{ label: string; value: string }>
}) => {
  const { register } = useFormContext()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <FormGroup
      className={`space-y-4 transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="space-y-2 w-full lg:w-1/2">
          {renderFormField({
            field: KafkaBaseFormConfig.base.fields.authMethod,
            register,
            errors,
            readOnly,
          })}
        </div>
        <div className="space-y-2 w-full lg:w-1/2">
          {renderFormField({
            field: {
              ...KafkaBaseFormConfig.base.fields.securityProtocol,
              options: securityProtocolOptions,
            },
            register,
            errors,
            readOnly,
          })}
        </div>
      </div>
      <div className="space-y-2 w-full">
        {renderFormField({
          field: KafkaBaseFormConfig.base.fields.bootstrapServers,
          register,
          errors,
          readOnly,
        })}
      </div>
    </FormGroup>
  )
}

// Main component that selects the correct form based on auth type and protocol
export const KafkaConnectionFormRenderer = ({
  authMethod,
  securityProtocol,
  errors,
  readOnly,
}: {
  authMethod: string
  securityProtocol: string
  errors: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}) => {
  const { watch } = useFormContext()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200)
    return () => clearTimeout(timer)
  }, [])

  const authMethodSelected = watch('authMethod')

  // Determine security protocol options based on auth method
  const securityProtocolOptions = Object.values(
    authMethodSelected === AUTH_OPTIONS['SASL/SCRAM-256'].name ||
      authMethodSelected === AUTH_OPTIONS['SASL/SCRAM-512'].name
      ? SECURITY_PROTOCOL_OPTIONS_SASL
      : SECURITY_PROTOCOL_OPTIONS,
  ).map((option) => ({
    label: option,
    value: option,
  }))

  const renderBaseForm = ({ authMethod, readOnly }: { authMethod: string; readOnly?: boolean }) => {
    return (
      <KafkaBaseForm
        errors={errors}
        authMethod={authMethod}
        readOnly={readOnly}
        securityProtocolOptions={securityProtocolOptions}
      />
    )
  }

  const renderAuthForm = ({ readOnly }: { readOnly?: boolean }) => {
    switch (authMethod) {
      case 'SASL/PLAIN':
        return <SaslPlainForm errors={errors} readOnly={readOnly} />
      case 'SASL/JAAS':
        return <SaslJaasForm errors={errors} readOnly={readOnly} />
      case 'SASL/GSSAPI':
        return <SaslGssapiForm errors={errors} readOnly={readOnly} />
      case 'SASL/OAUTHBEARER':
        return <SaslOauthbearerForm errors={errors} readOnly={readOnly} />
      case 'SASL/SCRAM-256':
        return <SaslScram256Form errors={errors} readOnly={readOnly} />
      case 'SASL/SCRAM-512':
        return <SaslScram512Form errors={errors} readOnly={readOnly} />
      case 'AWS_MSK_IAM':
        return <AwsIamForm errors={errors} readOnly={readOnly} />
      case 'mTLS':
        return <MtlsForm errors={errors} readOnly={readOnly} />
      case 'Delegation tokens':
        return <DelegationTokensForm errors={errors} readOnly={readOnly} />
      case 'SASL/LDAP':
        return <LdapForm errors={errors} readOnly={readOnly} />
      case 'NO_AUTH':
        return <NoAuthForm errors={errors} readOnly={readOnly} />
      default:
        return <SaslPlainForm errors={errors} readOnly={readOnly} />
    }
  }

  const renderTruststoreForm = ({ readOnly }: { readOnly?: boolean }) => {
    return <TruststoreForm errors={errors} readOnly={readOnly} />
  }

  return (
    <div
      className={`space-y-4 md:space-y-6 transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div>{renderBaseForm({ authMethod, readOnly })}</div>
      <div>{renderAuthForm({ readOnly: readOnly })}</div>
      {/* <div>{renderTruststoreForm({ readOnly: readOnly })}</div> */}
    </div>
  )
}
