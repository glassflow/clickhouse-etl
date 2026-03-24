import { useFormContext, Controller } from 'react-hook-form'
import { FormGroup } from '@/src/components/ui'
import { renderFormField } from '@/src/components/ui/form'
import { KafkaBaseFormConfig } from '@/src/config/kafka-connection-form-config'
import { FieldErrors } from 'react-hook-form'
import { KafkaConnectionFormType } from '@/src/scheme'
import { AUTH_OPTIONS } from '@/src/config/constants'
import { useEffect, useState } from 'react'
import { SECURITY_PROTOCOL_OPTIONS_SASL, SECURITY_PROTOCOL_OPTIONS } from '@/src/config/constants'
import { Checkbox } from '@/src/components/ui/checkbox'
import { Switch } from '@/src/components/ui/switch'
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
} from './forms'

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
      className={`space-y-4 transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
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

// Schema Registry collapsible section
const SchemaRegistrySection = ({
  schemaRegistryError,
  readOnly,
}: {
  schemaRegistryError?: string
  readOnly?: boolean
}) => {
  const { register, watch, control, formState: { errors } } = useFormContext<KafkaConnectionFormType>()
  const enabled = watch('schemaRegistry.enabled')

  return (
    <div className="border-t border-[var(--color-border-neutral-faded)] pt-6 space-y-4">
      <div className="flex items-center gap-3">
        <Controller
          name="schemaRegistry.enabled"
          control={control}
          defaultValue={false}
          render={({ field }) => (
            // <Checkbox
            //   id="schemaRegistry-enabled"
            //   checked={!!field.value}
            //   onCheckedChange={(checked) => field.onChange(!!checked)}
            //   disabled={readOnly}
            // />
            <Switch
              id="schemaRegistry-enabled"
              checked={!!field.value}
              onCheckedChange={(checked) => field.onChange(!!checked)}
              disabled={readOnly}
            />
          )}
        />
        <label htmlFor="schemaRegistry-enabled" className="text-sm font-medium cursor-pointer select-none text-[var(--color-foreground-neutral)]">
          Use Schema Registry
        </label>
      </div>

      {enabled && (
        <div className="space-y-4 pl-6">
          <div className="space-y-2">
            {renderFormField({
              field: {
                name: 'schemaRegistry.url',
                label: 'Registry URL',
                placeholder: 'https://...',
                type: 'text',
                required: 'Registry URL is required',
              },
              register,
              errors,
              readOnly,
            })}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-foreground-neutral)]">
              Authentication
            </label>
            <Controller
              name="schemaRegistry.authMethod"
              control={control}
              defaultValue="none"
              render={({ field }) => (
                <select
                  value={field.value ?? 'none'}
                  onChange={(e) => field.onChange(e.target.value)}
                  disabled={readOnly}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="none">No auth</option>
                  <option value="api_key">API Key + Secret</option>
                  <option value="basic">Username + Password</option>
                </select>
              )}
            />
          </div>

          {watch('schemaRegistry.authMethod') === 'api_key' && (
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="space-y-2 w-full lg:w-1/2">
                {renderFormField({
                  field: {
                    name: 'schemaRegistry.apiKey',
                    label: 'API Key',
                    placeholder: 'Optional',
                    type: 'text',
                  },
                  register,
                  errors,
                  readOnly,
                })}
              </div>
              <div className="space-y-2 w-full lg:w-1/2">
                {renderFormField({
                  field: {
                    name: 'schemaRegistry.apiSecret',
                    label: 'API Secret',
                    placeholder: 'Optional',
                    type: 'password',
                  },
                  register,
                  errors,
                  readOnly,
                })}
              </div>
            </div>
          )}

          {watch('schemaRegistry.authMethod') === 'basic' && (
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="space-y-2 w-full lg:w-1/2">
                {renderFormField({
                  field: {
                    name: 'schemaRegistry.username',
                    label: 'Username',
                    placeholder: 'Username',
                    type: 'text',
                    required: 'Username is required',
                  },
                  register,
                  errors,
                  readOnly,
                })}
              </div>
              <div className="space-y-2 w-full lg:w-1/2">
                {renderFormField({
                  field: {
                    name: 'schemaRegistry.password',
                    label: 'Password',
                    placeholder: 'Password',
                    type: 'password',
                    required: 'Password is required',
                  },
                  register,
                  errors,
                  readOnly,
                })}
              </div>
            </div>
          )}

          {schemaRegistryError && (
            <p className="text-sm text-destructive">
              Schema Registry connection failed: {schemaRegistryError}. Check the URL and credentials.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Main component that selects the correct form based on auth type and protocol
export const KafkaConnectionFormRenderer = ({
  authMethod,
  securityProtocol,
  errors,
  readOnly,
  schemaRegistryError,
}: {
  authMethod: string
  securityProtocol: string
  errors: FieldErrors<KafkaConnectionFormType>
  readOnly?: boolean
  schemaRegistryError?: string
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

  // TruststoreForm is rendered inside auth-specific forms (NoAuthForm, SaslPlainForm,
  // SaslGssapiForm, SaslScram256Form, SaslScram512Form) when SSL or SASL_SSL is selected.
  // See KAFKA_CONNECTION.md for the form hierarchy.

  return (
    <div
      className={`space-y-4 md:space-y-6 transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
    >
      <div>{renderBaseForm({ authMethod, readOnly })}</div>
      <div>{renderAuthForm({ readOnly: readOnly })}</div>
      <SchemaRegistrySection schemaRegistryError={schemaRegistryError} readOnly={readOnly} />
    </div>
  )
}
