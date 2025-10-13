import { useFormContext } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
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
          <div className="text-sm font-medium text-gray-700">SSL/TLS Configuration (Optional)</div>
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
          <div className="text-sm font-medium text-gray-700">SSL/TLS Configuration (Optional)</div>
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

  // Get all fields except kerberosKeytab (we'll render it separately)
  const fields = KafkaFormConfig['SASL/GSSAPI'].fields
  const fieldsToRender = Object.entries(fields).filter(([key]) => key !== 'kerberosKeytab')

  // Helper function to handle keytab file upload
  const handleKeytabUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      // Read file as base64 (binary file)
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64Content = e.target?.result as string
        // Store the base64 encoded keytab
        setValue('saslGssapi.kerberosKeytab', base64Content, {
          shouldValidate: true,
          shouldDirty: true,
        })
      }
      reader.readAsDataURL(file) // Read as base64
    } catch (error) {
      console.error('Error reading keytab file:', error)
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

      {/* Custom keytab file upload field */}
      <div className="space-y-2 w-full">
        <label htmlFor="saslGssapi.kerberosKeytab" className="block text-sm font-medium text-gray-700">
          Kerberos Keytab File *
        </label>
        <input
          type="file"
          id="saslGssapi.kerberosKeytab"
          accept=".keytab"
          onChange={handleKeytabUpload}
          disabled={readOnly}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-gray-500">Upload your Kerberos keytab file (binary file)</p>
        {getFieldError(errors, 'saslGssapi.kerberosKeytab') && (
          <p className="text-sm text-red-500">{getFieldError(errors, 'saslGssapi.kerberosKeytab')}</p>
        )}
      </div>

      {showTruststoreFields && (
        <div className="space-y-4 mt-4">
          <div className="text-sm font-medium text-gray-700">SSL/TLS Configuration (Optional)</div>
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
          <div className="text-sm font-medium text-gray-700">SSL/TLS Configuration (Optional)</div>
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
          <div className="text-sm font-medium text-gray-700">SSL/TLS Configuration (Optional)</div>
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
  const { register, setValue } = useFormContext()

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
        if (key === 'location') {
          return null
        }

        // For the certificates field, use a custom file upload + textarea combination
        if (key === 'certificates') {
          return (
            <div key={key} className="space-y-2 w-full">
              <label htmlFor={fieldWithPrefix.name} className="block text-sm font-medium text-gray-700">
                {field.label}
              </label>

              {/* File Upload Section */}
              <div className="space-y-2">
                <CertificateFileUpload
                  onFileRead={(content) => {
                    setValue(fieldWithPrefix.name, content, { shouldValidate: true, shouldDirty: true })
                  }}
                  disabled={readOnly}
                  className="w-full"
                />
              </div>

              {/* Textarea for manual paste or viewing content */}
              <div className="space-y-1">
                <label htmlFor={`${fieldWithPrefix.name}-textarea`} className="block text-xs text-gray-500">
                  Or paste certificate content:
                </label>
                <textarea
                  id={`${fieldWithPrefix.name}-textarea`}
                  {...register(fieldWithPrefix.name, {
                    required: false,
                  })}
                  placeholder={field.placeholder}
                  className="w-full min-h-[150px] px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  readOnly={readOnly}
                />
              </div>

              {/* Show error if exists */}
              {errors && getFieldError(errors, fieldWithPrefix.name) && (
                <p className="text-sm text-red-500">{getFieldError(errors, fieldWithPrefix.name)}</p>
              )}
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
