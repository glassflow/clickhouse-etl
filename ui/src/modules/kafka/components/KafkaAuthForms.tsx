import { useFormContext } from 'react-hook-form'
import { FormControl, FormLabel, FormGroup, Switch } from '@/src/components/ui'
import { useRenderFormFields, renderFormField } from '@/src/components/ui/form'
import { KafkaBaseFormConfig, KafkaFormConfig } from '@/src/config/kafka-connection-form-config'
import { FieldErrors } from 'react-hook-form'
import { KafkaConnectionFormType } from '@/src/scheme'
import { AUTH_OPTIONS } from '@/src/config/constants'
import { useWatch } from 'react-hook-form'
import { useEffect } from 'react'

// Base form - mandatory fields - allways present in the form
export const KafkaBaseForm = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  const { register } = useFormContext()

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
            field: KafkaBaseFormConfig.base.fields.securityProtocol,
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
// SASL/PLAIN specific form
export const SaslPlainForm = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  const { register } = useFormContext()

  return (
    <FormGroup className="space-y-4">
      <div className="flex gap-4">
        <div className="space-y-2 w-1/2">
          {renderFormField({
            field: KafkaFormConfig[AUTH_OPTIONS['SASL/PLAIN'].name].fields.username as any,
            register,
            errors,
          })}
        </div>
        <div className="space-y-2 w-1/2">
          {renderFormField({
            field: KafkaFormConfig[AUTH_OPTIONS['SASL/PLAIN'].name].fields.password as any,
            register,
            errors,
          })}
        </div>
      </div>
      {/* <div className="space-y-2 w-[50%] pr-2">
        {renderFormField({
          field: KafkaFormConfig[AUTH_OPTIONS['SASL/PLAIN'].name].fields.consumerGroup as any,
          register,
          errors,
        })}
      </div> */}
      {/* {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/PLAIN',
        register,
        errors,
      })} */}
    </FormGroup>
  )
}

// NO_AUTH specific form
export const NoAuthForm = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  return <FormGroup className="space-y-4"></FormGroup>
}

// SASL/JAAS specific form
export const SaslJaasForm = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  const { register } = useFormContext()

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/JAAS',
        register,
        errors,
      })}
    </FormGroup>
  )
}

// SASL/GSSAPI specific form
export const SaslGssapiForm = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  const { register } = useFormContext()

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/GSSAPI',
        register,
        errors,
      })}
    </FormGroup>
  )
}

// SASL/OAUTHBEARER specific form
export const SaslOauthbearerForm = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  const { register } = useFormContext()

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/OAUTHBEARER',
        register,
        errors,
      })}
    </FormGroup>
  )
}

// SASL/SCRAM-256 specific form
export const SaslScram256Form = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/SCRAM-256',
        register,
        errors,
      })}
    </FormGroup>
  )
}

// SASL/SCRAM-512 specific form
export const SaslScram512Form = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/SCRAM-512',
        register,
        errors,
      })}
    </FormGroup>
  )
}

// mTLS specific form
export const MtlsForm = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'mTLS',
        register,
        errors,
      })}
    </FormGroup>
  )
}

// AWS_MSK_IAM specific form
export const AwsIamForm = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'AWS_MSK_IAM',
        register,
        errors,
      })}
    </FormGroup>
  )
}

// Delegation tokens specific form
export const DelegationTokensForm = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'Delegation tokens',
        register,
        errors,
      })}
    </FormGroup>
  )
}

// LDAP specific form
export const LdapForm = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/LDAP',
        register,
        errors,
      })}
    </FormGroup>
  )
}

// Truststore specific form
export const TruststoreForm = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  const { register } = useFormContext()

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'trustStore',
        register,
        errors,
      })}
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
  const renderBaseForm = () => {
    return <KafkaBaseForm errors={errors} />
  }

  const authMethodSelected = watch('authMethod')
  const securityProtocolSelected = watch('securityProtocol')

  useEffect(() => {
    // Only set the default value if the user hasn't manually changed it yet
    // or if we're switching between auth methods
    if (authMethodSelected === 'SASL/SCRAM-256' || authMethodSelected === 'SASL/SCRAM-512') {
      setValue('securityProtocol', 'SASL_SSL')
    } else if (authMethodSelected === 'SASL/PLAIN' || authMethodSelected === 'NO_AUTH') {
      setValue('securityProtocol', 'SASL_PLAINTEXT')
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
      {renderBaseForm()}
      {renderAuthForm()}
      {renderSslFields()}
    </>
  )
}
