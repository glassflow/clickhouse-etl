import { useFormContext } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
import { InputFile } from '@/src/components/common/InputFile'
import { useRenderFormFields, renderFormField } from '@/src/components/ui/form'
import { KafkaFormConfig } from '@/src/config/kafka-connection-form-config'
import { FieldErrors } from 'react-hook-form'
import { KafkaConnectionFormType } from '@/src/scheme'
import { AUTH_OPTIONS } from '@/src/config/constants'
import { CertificateFileUpload } from '@/src/components/common/CertificateFileUpload'

// SASL/PLAIN specific form
export const SaslPlainForm = ({
  errors,
  readOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}) => {
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
            field: KafkaFormConfig[AUTH_OPTIONS['SASL/PLAIN'].name].fields.username as any,
            register,
            errors,
            readOnly,
          })}
        </div>
        <div className="space-y-2 w-full lg:w-1/2">
          {renderFormField({
            field: KafkaFormConfig[AUTH_OPTIONS['SASL/PLAIN'].name].fields.password as any,
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

// NO_AUTH specific form
export const NoAuthForm = ({
  errors,
  readOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}) => {
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

// SASL/JAAS specific form
export const SaslJaasForm = ({
  errors,
  readOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/JAAS',
        register,
        errors,
        readOnly,
      })}
    </FormGroup>
  )
}

// SASL/GSSAPI specific form
export const SaslGssapiForm = ({
  errors,
  readOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}) => {
  const { register, watch, setValue } = useFormContext()
  const securityProtocolSelected = watch('securityProtocol')
  const showTruststoreFields = securityProtocolSelected === 'SASL_SSL' || securityProtocolSelected === 'SSL'

  const fields = KafkaFormConfig['SASL/GSSAPI'].fields
  const fieldsToRender = Object.entries(fields).filter(([key]) => key !== 'kerberosKeytab' && key !== 'krb5Config')

  const handleKeytabUpload = (fileContent: string, fileName: string) => {
    try {
      setValue('saslGssapi.kerberosKeytab', fileContent, {
        shouldValidate: true,
        shouldDirty: true,
      })
      setValue('saslGssapi.kerberosKeytabFileName', fileName, {
        shouldValidate: false,
        shouldDirty: true,
      })
    } catch (error) {
      console.error('Error reading keytab file:', error)
    }
  }

  const handleKrb5ConfigUpload = (fileContent: string, fileName: string) => {
    try {
      setValue('saslGssapi.krb5Config', fileContent, {
        shouldValidate: true,
        shouldDirty: true,
      })
      setValue('saslGssapi.krb5ConfigFileName', fileName, {
        shouldValidate: false,
        shouldDirty: true,
      })
    } catch (error) {
      console.error('Error reading krb5.conf file:', error)
    }
  }

  return (
    <FormGroup className="space-y-4">
      {/* Render all fields except kerberosKeytab */}
      {fieldsToRender.map(([key, field]: [string, any]) => (
        <div key={key} className="space-y-2 w-full">
          {renderFormField({
            field,
            register,
            errors,
            readOnly,
          })}
        </div>
      ))}

      <div className="space-y-2 w-full">
        <InputFile
          label="Kerberos Configuration (krb5.conf) File"
          id="saslGssapi.krb5Config"
          placeholder="Select krb5.conf file"
          allowedFileTypes={['conf', 'txt', 'cfg', 'ini', 'properties']}
          onChange={handleKrb5ConfigUpload}
          value={watch('saslGssapi.krb5Config')}
          initialFileName={watch('saslGssapi.krb5ConfigFileName')}
          readType="text"
          showLoadingState={true}
          showErrorState={true}
          hintText="Accepted formats: .conf, .txt, .cfg, .ini, .properties"
          externalError={errors ? getFieldError(errors, 'saslGssapi.krb5Config') : undefined}
        />
      </div>

      <div className="space-y-2 w-full">
        <InputFile
          label="Kerberos Keytab File"
          id="saslGssapi.kerberosKeytab"
          placeholder="Select keytab file"
          allowedFileTypes={['keytab', 'txt']}
          onChange={handleKeytabUpload}
          value={watch('saslGssapi.kerberosKeytab')}
          initialFileName={watch('saslGssapi.kerberosKeytabFileName')}
          readType="base64"
          showLoadingState={true}
          showErrorState={true}
          hintText="Accepted formats: .keytab, .txt"
          externalError={errors ? getFieldError(errors, 'saslGssapi.kerberosKeytab') : undefined}
        />
      </div>

      {showTruststoreFields && (
        <div className="space-y-4 mt-4">
          <div className="text-sm font-medium text-content">SSL/TLS Configuration</div>
          <TruststoreForm errors={errors} readOnly={readOnly} authMethodPrefix="saslGssapi" />
        </div>
      )}
    </FormGroup>
  )
}

// SASL/OAUTHBEARER specific form
export const SaslOauthbearerForm = ({
  errors,
  readOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/OAUTHBEARER',
        register,
        errors,
        readOnly,
      })}
    </FormGroup>
  )
}

// SASL/SCRAM-256 specific form
export const SaslScram256Form = ({
  errors,
  readOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}) => {
  const { register, watch } = useFormContext()
  const securityProtocolSelected = watch('securityProtocol')
  const showTruststoreFields = securityProtocolSelected === 'SASL_SSL' || securityProtocolSelected === 'SSL'

  return (
    <FormGroup className="space-y-4">
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'SASL/SCRAM-256',
        register,
        errors,
        readOnly,
      })}
      {showTruststoreFields && (
        <div className="space-y-4 mt-4">
          <div className="text-sm font-medium text-content">SSL/TLS Configuration</div>
          <TruststoreForm errors={errors} readOnly={readOnly} authMethodPrefix="saslScram256" />
        </div>
      )}
    </FormGroup>
  )
}

// SASL/SCRAM-512 specific form
export const SaslScram512Form = ({
  errors,
  readOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}) => {
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

// mTLS specific form
export const MtlsForm = ({
  errors,
  readOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'mTLS',
        register,
        errors,
        readOnly,
      })}
    </FormGroup>
  )
}

// AWS_MSK_IAM specific form
export const AwsIamForm = ({
  errors,
  readOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'AWS_MSK_IAM',
        register,
        errors,
        readOnly,
      })}
    </FormGroup>
  )
}

// Delegation tokens specific form
export const DelegationTokensForm = ({
  errors,
  readOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}) => {
  const { register } = useFormContext()

  return (
    <FormGroup>
      {useRenderFormFields({
        formConfig: KafkaFormConfig,
        formGroupName: 'Delegation tokens',
        register,
        errors,
        readOnly,
      })}
    </FormGroup>
  )
}

// LDAP specific form
export const LdapForm = ({
  errors,
  readOnly,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
}) => {
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

// Truststore specific form
export const TruststoreForm = ({
  errors,
  readOnly,
  authMethodPrefix,
}: {
  errors?: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
  authMethodPrefix?: string // e.g., 'saslPlain', 'noAuth', 'saslScram256'
}) => {
  const { register, setValue, watch } = useFormContext()

  // Render truststore fields with the appropriate auth method prefix
  const fields = KafkaFormConfig.truststore.fields
  const prefix = authMethodPrefix ? `${authMethodPrefix}.truststore` : 'truststore'

  return (
    <FormGroup className="space-y-4">
      {Object.entries(fields).map(([key, field]: [string, any]) => {
        const fieldWithPrefix = {
          ...field,
          name: `${prefix}.${key}`,
        }

        // Skip rendering the 'location' field as we'll use CertificateFileUpload for 'certificates'
        // Skip rendering other fields that are not relevant to the truststore - for now
        if (key === 'location' || key === 'password' || key === 'type' || key === 'algorithm') {
          return null
        }

        // For the certificates field, use a custom file upload + textarea combination
        if (key === 'certificates') {
          const certificateError = errors ? getFieldError(errors, fieldWithPrefix.name) : undefined
          const fileNameFieldName = `${prefix}.certificatesFileName`

          return (
            <div key={key} className="space-y-2 w-full">
              <label htmlFor={fieldWithPrefix.name} className="block text-sm font-medium text-content">
                {field.label}
              </label>

              {/* File Upload Section */}
              <div className="space-y-2">
                <CertificateFileUpload
                  onFileRead={(content, fileName) => {
                    setValue(fieldWithPrefix.name, content, { shouldValidate: true, shouldDirty: true })
                    setValue(fileNameFieldName, fileName, { shouldValidate: false, shouldDirty: true })
                  }}
                  disabled={readOnly}
                  className="w-full"
                  externalError={certificateError}
                  value={watch(fieldWithPrefix.name)}
                  initialFileName={watch(fileNameFieldName)}
                />
              </div>

              {/* Textarea for manual paste or viewing content */}
              <div className="space-y-1 mt-2">
                <label htmlFor={`${fieldWithPrefix.name}-textarea`} className="block text-xs text-content">
                  Or paste certificate content:
                </label>
                <textarea
                  id={`${fieldWithPrefix.name}-textarea`}
                  {...register(fieldWithPrefix.name, {
                    required: false,
                  })}
                  placeholder={field.placeholder}
                  className={`w-full min-h-[150px] px-3 py-2 text-sm rounded-md font-mono input-border-regular focus:outline-none focus:border-[var(--color-background-primary,#a5b9e4)] focus:shadow-[0_0_0_2px_rgba(165,185,228,0.25)] ${
                    certificateError ? 'input-border-error' : ''
                  }`}
                  readOnly={readOnly}
                />
              </div>

              {/* Show error if exists */}
              {certificateError && <p className="text-sm text-content">{certificateError}</p>}
            </div>
          )
        }

        // For the skipTlsVerification field, render it as a boolean switch
        if (key === 'skipTlsVerification') {
          return (
            <div key={key} className="space-y-2 w-full">
              {renderFormField({
                field: {
                  ...fieldWithPrefix,
                  readOnly: readOnly,
                  defaultValue: field.defaultValue?.toString(),
                },
                register,
                errors,
                readOnly,
              })}
            </div>
          )
        }

        return (
          <div key={key} className="space-y-2 w-full">
            {renderFormField({
              field: fieldWithPrefix,
              register,
              errors,
              readOnly,
            })}
          </div>
        )
      })}
    </FormGroup>
  )
}

// Helper function to get field error (moved here from form.tsx if not exported)
function getFieldError(errors: any, path: string): string | undefined {
  if (!errors) return undefined
  if (!path) return undefined

  const parts = path?.split('.')
  let current = errors

  for (const part of parts) {
    if (!current[part]) return undefined
    current = current[part]
  }

  return current.message ? current.message : undefined
}
