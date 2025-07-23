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
} from './form-variants'

// Base form - mandatory fields - allways present in the form
export const KafkaBaseForm = ({
  errors,
  authMethod,
  securityProtocol,
  readOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  authMethod: string
  securityProtocol: string
  readOnly?: boolean
}) => {
  const { register } = useFormContext()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const securityProtocolOptions = Object.values(
    authMethod === AUTH_OPTIONS['SASL/SCRAM-256'].name || authMethod === AUTH_OPTIONS['SASL/SCRAM-512'].name
      ? SECURITY_PROTOCOL_OPTIONS_SASL
      : SECURITY_PROTOCOL_OPTIONS,
  ).map((option) => ({
    label: option,
    value: option,
  }))

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
      {/* INFO: old implementation - using useRenderFormFields - does not allow custom styles and layout*/}
      {/* {useRenderFormFields({
        formConfig: KafkaBaseFormConfig,
        formGroupName: 'base',
        register,
        errors,
      })} */}
    </FormGroup>
  )
}

// Main component that selects the correct form based on auth type and protocol
export const KafkaAuthForm = ({
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
  const { watch, setValue } = useFormContext()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200)
    return () => clearTimeout(timer)
  }, [])
  const authMethodSelected = watch('authMethod')
  const securityProtocolSelected = watch('securityProtocol')

  const renderBaseForm = ({
    authMethod,
    securityProtocol,
    readOnly,
  }: {
    authMethod: string
    securityProtocol: string
    readOnly?: boolean
  }) => {
    return (
      <KafkaBaseForm errors={errors} authMethod={authMethod} securityProtocol={securityProtocol} readOnly={readOnly} />
    )
  }

  useEffect(() => {
    // Only set the default value if the user hasn't manually changed it yet
    // or if we're switching between auth methods
    if (authMethodSelected === 'SASL/SCRAM-256' || authMethodSelected === 'SASL/SCRAM-512') {
      setValue('securityProtocol', 'SASL_SSL')
    } else if (authMethodSelected === 'SASL/PLAIN') {
      setValue('securityProtocol', 'SASL_PLAINTEXT')
    } else if (authMethodSelected === 'NO_AUTH') {
      setValue('securityProtocol', 'PLAINTEXT')
    } else if (authMethodSelected === 'SASL/JAAS') {
      setValue('securityProtocol', 'SASL_JAAS')
    } else if (authMethodSelected === 'SASL/GSSAPI') {
      setValue('securityProtocol', 'SASL_GSSAPI')
    }
    // Only run when authMethodSelected changes, not when securityProtocolSelected changes
  }, [authMethodSelected, setValue])

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

  const { register } = useFormContext()

  // SSL-specific fields that show up when SASL_SSL is selected
  const renderSslFields = ({ readOnly }: { readOnly?: boolean }) => {
    if (securityProtocol === 'SASL_SSL') {
      return (
        <FormGroup>
          {/* <FormLabel>SSL Verification</FormLabel> */}
          {/* <FormControl><Switch {...register('sslVerification')} /></FormControl> */}
          {/* <TruststoreForm errors={errors} /> */}
        </FormGroup>
      )
    }
    return null
  }

  return (
    <div
      className={`space-y-4 md:space-y-6 transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div>{renderBaseForm({ authMethod, securityProtocol, readOnly })}</div>
      <div>{renderAuthForm({ readOnly: readOnly })}</div>
      <div>{renderSslFields({ readOnly: readOnly })}</div>
    </div>
  )
}
