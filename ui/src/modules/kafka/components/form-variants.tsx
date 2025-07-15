import { useFormContext } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
import { useRenderFormFields, renderFormField } from '@/src/components/ui/form'
import { KafkaFormConfig } from '@/src/config/kafka-connection-form-config'
import { FieldErrors } from 'react-hook-form'
import { KafkaConnectionFormType } from '@/src/scheme'
import { AUTH_OPTIONS } from '@/src/config/constants'

// SASL/PLAIN specific form
export const SaslPlainForm = ({ errors }: { errors?: FieldErrors<KafkaConnectionFormType> }) => {
  const { register } = useFormContext()
  const { watch } = useFormContext()
  const authMethodSelected = watch('authMethod')
  const securityProtocolSelected = watch('securityProtocol')
  const showCertificateField =
    (authMethodSelected === AUTH_OPTIONS['SASL/PLAIN'].name &&
      (securityProtocolSelected === 'SASL_SSL' || securityProtocolSelected === 'SSL')) ||
    (authMethodSelected === AUTH_OPTIONS['NO_AUTH'].name &&
      (securityProtocolSelected === 'SASL_SSL' || securityProtocolSelected === 'SSL'))

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
      <div className="space-y-2 w-full">
        {showCertificateField && (
          <div className="space-y-2 w-full">
            {renderFormField({
              field: KafkaFormConfig[AUTH_OPTIONS['SASL/PLAIN'].name].fields.certificate as any,
              register,
              errors,
            })}
          </div>
        )}
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
  const { register } = useFormContext()
  const { watch } = useFormContext()
  const authMethodSelected = watch('authMethod')
  const securityProtocolSelected = watch('securityProtocol')
  const showCertificateField =
    authMethodSelected === AUTH_OPTIONS['NO_AUTH'].name &&
    (securityProtocolSelected === 'SASL_SSL' || securityProtocolSelected === 'SSL')
  return (
    <FormGroup className="space-y-4">
      <div className="flex gap-4">
        {showCertificateField && (
          <div className="space-y-2 w-full">
            {renderFormField({
              field: KafkaFormConfig[AUTH_OPTIONS['NO_AUTH'].name].fields.certificate as any,
              register,
              errors,
            })}
          </div>
        )}
      </div>
    </FormGroup>
  )
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
