import { useFormContext } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
import { useRenderFormFields, renderFormField } from '@/src/components/ui/form'
import { KafkaFormConfig } from '@/src/config/kafka-connection-form-config'
import { FieldErrors } from 'react-hook-form'
import { KafkaConnectionFormType } from '@/src/scheme'
import { AUTH_OPTIONS } from '@/src/config/constants'

// SASL/PLAIN specific form
export const SaslPlainForm = ({
  errors,
  viewOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  viewOnly?: boolean
}) => {
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
            viewOnly,
          })}
        </div>
        <div className="space-y-2 w-1/2">
          {renderFormField({
            field: KafkaFormConfig[AUTH_OPTIONS['SASL/PLAIN'].name].fields.password as any,
            register,
            errors,
            viewOnly,
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
              viewOnly,
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
export const NoAuthForm = ({
  errors,
  viewOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  viewOnly?: boolean
}) => {
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
              viewOnly,
            })}
          </div>
        )}
      </div>
    </FormGroup>
  )
}

// SASL/JAAS specific form
export const SaslJaasForm = ({
  errors,
  viewOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  viewOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/JAAS',
        register,
        errors,
        viewOnly,
      })}
    </FormGroup>
  )
}

// SASL/GSSAPI specific form
export const SaslGssapiForm = ({
  errors,
  viewOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  viewOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/GSSAPI',
        register,
        errors,
        viewOnly,
      })}
    </FormGroup>
  )
}

// SASL/OAUTHBEARER specific form
export const SaslOauthbearerForm = ({
  errors,
  viewOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  viewOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/OAUTHBEARER',
        register,
        errors,
        viewOnly,
      })}
    </FormGroup>
  )
}

// SASL/SCRAM-256 specific form
export const SaslScram256Form = ({
  errors,
  viewOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  viewOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/SCRAM-256',
        register,
        errors,
        viewOnly,
      })}
    </FormGroup>
  )
}

// SASL/SCRAM-512 specific form
export const SaslScram512Form = ({
  errors,
  viewOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  viewOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/SCRAM-512',
        register,
        errors,
        viewOnly,
      })}
    </FormGroup>
  )
}

// mTLS specific form
export const MtlsForm = ({
  errors,
  viewOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  viewOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'mTLS',
        register,
        errors,
        viewOnly,
      })}
    </FormGroup>
  )
}

// AWS_MSK_IAM specific form
export const AwsIamForm = ({
  errors,
  viewOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  viewOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'AWS_MSK_IAM',
        register,
        errors,
        viewOnly,
      })}
    </FormGroup>
  )
}

// Delegation tokens specific form
export const DelegationTokensForm = ({
  errors,
  viewOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  viewOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'Delegation tokens',
        register,
        errors,
        viewOnly,
      })}
    </FormGroup>
  )
}

// LDAP specific form
export const LdapForm = ({
  errors,
  viewOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  viewOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/LDAP',
        register,
        errors,
        viewOnly,
      })}
    </FormGroup>
  )
}

// Truststore specific form
export const TruststoreForm = ({
  errors,
  viewOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  viewOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'trustStore',
        register,
        errors,
        viewOnly,
      })}
    </FormGroup>
  )
}
