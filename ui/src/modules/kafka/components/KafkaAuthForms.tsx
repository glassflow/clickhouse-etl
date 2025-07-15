import { useFormContext } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
import { renderFormField } from '@/src/components/ui/form'
import { KafkaBaseFormConfig } from '@/src/config/kafka-connection-form-config'
import { FieldErrors } from 'react-hook-form'
import { KafkaConnectionFormType } from '@/src/scheme'
import { AUTH_OPTIONS } from '@/src/config/constants'
import { useEffect } from 'react'
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
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  authMethod: string
  securityProtocol: string
}) => {
  const { register } = useFormContext()

  const securityProtocolOptions = Object.values(
    authMethod === AUTH_OPTIONS['SASL/SCRAM-256'].name || authMethod === AUTH_OPTIONS['SASL/SCRAM-512'].name
      ? SECURITY_PROTOCOL_OPTIONS_SASL
      : SECURITY_PROTOCOL_OPTIONS,
  ).map((option) => ({
    label: option,
    value: option,
  }))

  return (
    <FormGroup className="space-y-4">
      <div className="flex gap-4">
        <div className="space-y-2 w-1/2">
          {renderFormField({
            field: KafkaBaseFormConfig.base.fields.authMethod,
            register,
            errors,
          })}
        </div>
        <div className="space-y-2 w-1/2">
          {renderFormField({
            field: {
              ...KafkaBaseFormConfig.base.fields.securityProtocol,
              options: securityProtocolOptions,
            },
            register,
            errors,
          })}
        </div>
      </div>
      <div className="space-y-2 w-full">
        {renderFormField({
          field: KafkaBaseFormConfig.base.fields.bootstrapServers,
          register,
          errors,
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
}: {
  authMethod: string
  securityProtocol: string
  errors: FieldErrors<KafkaConnectionFormType>
}) => {
  const { watch, setValue } = useFormContext()
  const authMethodSelected = watch('authMethod')
  const securityProtocolSelected = watch('securityProtocol')

  const renderBaseForm = ({ authMethod, securityProtocol }: { authMethod: string; securityProtocol: string }) => {
    return <KafkaBaseForm errors={errors} authMethod={authMethod} securityProtocol={securityProtocol} />
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

  const renderAuthForm = () => {
    switch (authMethod) {
      case 'SASL/PLAIN':
        return <SaslPlainForm errors={errors} />
      case 'SASL/JAAS':
        return <SaslJaasForm errors={errors} />
      case 'SASL/GSSAPI':
        return <SaslGssapiForm errors={errors} />
      case 'SASL/OAUTHBEARER':
        return <SaslOauthbearerForm errors={errors} />
      case 'SASL/SCRAM-256':
        return <SaslScram256Form errors={errors} />
      case 'SASL/SCRAM-512':
        return <SaslScram512Form errors={errors} />
      case 'AWS_MSK_IAM':
        return <AwsIamForm errors={errors} />
      case 'mTLS':
        return <MtlsForm errors={errors} />
      case 'Delegation tokens':
        return <DelegationTokensForm errors={errors} />
      case 'SASL/LDAP':
        return <LdapForm errors={errors} />
      case 'NO_AUTH':
        return <NoAuthForm errors={errors} />
      default:
        return <SaslPlainForm errors={errors} />
    }
  }

  const { register } = useFormContext()

  // SSL-specific fields that show up when SASL_SSL is selected
  const renderSslFields = () => {
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
    <>
      {renderBaseForm({ authMethod, securityProtocol })}
      {renderAuthForm()}
      {renderSslFields()}
    </>
  )
}
