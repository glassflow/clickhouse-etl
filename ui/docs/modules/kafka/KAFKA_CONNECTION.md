# Kafka Connection Module Documentation

## Overview

The Kafka Connection module handles all aspects of establishing and managing connections to Kafka clusters within the application. It provides a comprehensive form-based interface for configuring various authentication methods, security protocols, and connection parameters.

## Architecture

### Component Hierarchy

```
KafkaConnectionContainer (Container Component)
├── KafkaConnectionFormManager (Form Management)
│   ├── KafkaConnectionFormRenderer (Form Rendering)
│   │   ├── KafkaBaseForm (Base Fields - Always Visible)
│   │   │   ├── Auth Method Selector
│   │   │   ├── Security Protocol Selector
│   │   │   └── Bootstrap Servers Input
│   │   │
│   │   └── Auth-Specific Forms (Conditional Rendering)
│   │       ├── NoAuthForm
│   │       ├── SaslPlainForm
│   │       ├── SaslJaasForm
│   │       ├── SaslGssapiForm
│   │       ├── SaslOauthbearerForm
│   │       ├── SaslScram256Form
│   │       ├── SaslScram512Form
│   │       ├── AwsIamForm
│   │       ├── MtlsForm
│   │       ├── DelegationTokensForm
│   │       ├── LdapForm
│   │       └── TruststoreForm (Conditional - SSL/SASL_SSL)
│   │
│   └── FormActions (Submit, Discard, etc.)
│
└── Hooks & Utilities
    ├── useKafkaConnection (Connection Testing)
    ├── useStore (State Management)
    ├── useJourneyAnalytics (Analytics Tracking)
    └── usePipelineActions (Pipeline Operations)
```

## Core Components

### 1. KafkaConnectionContainer

**Location:** `src/modules/kafka/KafkaConnectionContainer.tsx`

**Purpose:** The main container component that orchestrates the Kafka connection flow. It manages state, handles connection testing, saves connection data, and coordinates with the store.

**Key Responsibilities:**
- Manages connection state from the global store (`kafkaStore`)
- Handles connection testing via `useKafkaConnection` hook
- Saves connection data to the store after successful connection
- Monitors bootstrap server changes and resets dependent stores
- Tracks analytics events for connection attempts
- Handles smart invalidation of dependent sections when topics change
- Supports both standalone (edit mode) and integrated (pipeline creation) flows

**Key Functions:**

#### `saveConnectionData(values: KafkaConnectionFormType)`
Saves the connection configuration to the store. In standalone mode, it also:
- Fetches topics from the new connection
- Compares with existing topics
- Invalidates dependent sections (topics, join, deduplication, clickhouse destination) if topics have changed

#### `fetchTopicsForConnection(connectionValues: KafkaConnectionFormType)`
Helper function that builds a request body based on the authentication method and fetches available topics from the Kafka cluster via `/ui-api/kafka/topics` endpoint.

#### `handleTestConnection(values: KafkaConnectionFormType)`
Initiates connection testing, tracks analytics, and saves data on success.

**State Management:**
- Reads from `kafkaStore` for current connection state
- Updates `kafkaStore` with new connection data
- Resets `topicsStore` when bootstrap servers change
- Marks `coreStore` as dirty in standalone mode

**Props:**
```typescript
{
  steps: any
  onCompleteStep?: (step: StepKeys) => void
  validate: () => Promise<boolean>
  standalone?: boolean
  readOnly?: boolean
  toggleEditMode?: (apiConfig?: any) => void
  onCompleteStandaloneEditing?: () => void
  pipelineActionState?: any
  pipeline?: any
}
```

### 2. KafkaConnectionFormManager

**Location:** `src/modules/kafka/components/KafkaConnectionFormManager.tsx`

**Purpose:** Manages the form state using React Hook Form, handles form validation, and coordinates form submission.

**Key Features:**
- Uses `react-hook-form` with Zod validation (`KafkaConnectionFormSchema`)
- Auto-selects security protocol based on auth method selection
- Tracks user interaction to control when validation errors are shown
- Handles form initialization when returning to a previously filled form
- Manages discard functionality to reset form to original values

**Form Configuration:**
- **Mode:** `onBlur` - validates fields when they lose focus
- **Criteria Mode:** `firstError` - shows first error per field
- **Focus Error:** `false` - doesn't auto-focus on errors

**Auto-Selection Logic:**
When a user changes the auth method, the security protocol is automatically set:
- `SASL/SCRAM-256` or `SASL/SCRAM-512` → `SASL_SSL`
- `SASL/PLAIN` → `SASL_PLAINTEXT`
- `NO_AUTH` → `PLAINTEXT`
- `SASL/JAAS` → `SASL_JAAS`
- `SASL/GSSAPI` → `SASL_GSSAPI`

**Validation Display:**
Validation errors are only shown when:
- User has interacted with the form (`userInteracted` state), OR
- Returning to a previously filled form with touched fields

**Submission Flow:**
1. User clicks "Continue" or submits form
2. Form validation is triggered manually
3. If validation passes:
   - In standalone mode: Always test connection, save only on success
   - In non-standalone mode: Test connection and proceed

### 3. KafkaConnectionFormRenderer

**Location:** `src/modules/kafka/components/KafkaConnectionFormRenderer.tsx`

**Purpose:** Renders the appropriate form fields based on the selected authentication method and security protocol.

**Rendering Logic:**
1. **Base Form:** Always rendered with:
   - Auth Method selector
   - Security Protocol selector (options filtered based on auth method)
   - Bootstrap Servers input

2. **Auth-Specific Form:** Conditionally rendered based on `authMethod`:
   - Uses a switch statement to render the appropriate form component
   - Each auth method has its own form component in `form-variants.tsx`

3. **Truststore Form:** Conditionally rendered when:
   - Security protocol is `SASL_SSL` or `SSL`
   - And the auth method supports truststore (SASL/PLAIN, SASL/GSSAPI, SASL/SCRAM-256, SASL/SCRAM-512, NO_AUTH)

**Security Protocol Options:**
- For SCRAM auth methods: Only SASL protocols are available
- For other auth methods: All security protocols are available

### 4. Form Variants (form-variants.tsx)

**Location:** `src/modules/kafka/components/form-variants.tsx`

**Purpose:** Contains all authentication method-specific form components.

**Available Forms:**

#### NoAuthForm
- Renders truststore fields when SSL/SASL_SSL is selected
- No additional authentication fields

#### SaslPlainForm
- Username and password fields
- Consumer group field
- Truststore fields (conditional on SSL/SASL_SSL)

#### SaslJaasForm
- JAAS configuration textarea

#### SaslGssapiForm
- Kerberos principal, realm, KDC, service name
- File upload for Kerberos keytab (base64 encoded)
- File upload for krb5.conf configuration
- Truststore fields (conditional on SSL/SASL_SSL)

#### SaslOauthbearerForm
- OAuth bearer token field

#### SaslScram256Form / SaslScram512Form
- Username and password fields
- Consumer group field
- Truststore fields (conditional on SSL/SASL_SSL)

#### AwsIamForm
- AWS access key, secret key, and region fields

#### MtlsForm
- Client certificate, client key, and password fields

#### DelegationTokensForm
- Delegation token field

#### LdapForm
- LDAP server URL, port, bind DN, bind password
- User search filter and base DN

#### TruststoreForm
- Certificate file upload (with textarea fallback)
- Skip TLS verification checkbox
- Supports different auth method prefixes for nested form paths

## Hooks

### useKafkaConnection

**Location:** `src/hooks/useKafkaConnection.ts`

**Purpose:** Provides connection testing functionality.

**API:**
```typescript
{
  testConnection: (values: KafkaConnectionFormType) => Promise<{success: boolean, message: string}>
  isConnecting: boolean
  connectionResult: {success: boolean, message: string} | null
  kafkaConnection: KafkaConnectionFormType | null
}
```

**Connection Testing Flow:**
1. Sets `isConnecting` to `true`
2. Builds request body based on auth method:
   - Extracts common fields (servers, securityProtocol, authMethod)
   - Adds auth-specific fields based on auth method
   - Includes truststore certificates and skipTlsVerification when applicable
3. Sends POST request to `/ui-api/kafka/`
4. On success:
   - Returns success result
   - Updates local state with connection info
   - Shows success notification
5. On failure:
   - Returns error result
   - Shows error notification via `notify()`
   - Updates local state with failed connection

**Request Body Construction:**
The hook constructs different request bodies based on the authentication method. Each auth method includes its specific fields:
- **NO_AUTH:** certificate (from truststore)
- **SASL/PLAIN:** username, password, consumerGroup, certificate
- **SASL/JAAS:** jaasConfig
- **SASL/GSSAPI:** kerberosPrincipal, kerberosKeytab, kerberosRealm, kdc, serviceName, krb5Config, certificate
- **SASL/OAUTHBEARER:** oauthBearerToken
- **SASL/SCRAM-256/512:** username, password, consumerGroup, certificate
- **AWS_MSK_IAM:** awsAccessKey, awsAccessKeySecret, awsRegion
- **Delegation tokens:** delegationToken
- **SASL/LDAP:** ldapServerUrl, ldapServerPort, ldapBindDn, ldapBindPassword, ldapUserSearchFilter, ldapBaseDn
- **mTLS:** clientCert, clientKey, password

## State Management

### KafkaStore

**Location:** `src/store/kafka.store.ts`

**Purpose:** Manages all Kafka connection-related state using Zustand.

**State Structure:**
```typescript
{
  // Status
  isConnected: boolean
  
  // Base connection values
  authMethod: string
  securityProtocol: string
  bootstrapServers: string
  
  // Auth method-specific data
  saslPlain: SaslPlainFormType
  saslJaas: SaslJaasFormType
  saslGssapi: SaslGssapiFormType
  saslOauthbearer: SaslOauthbearerFormType
  saslScram256: SaslScram256FormType
  saslScram512: SaslScram512FormType
  noAuth: NoAuthFormType
  awsIam: AwsIamFormType
  delegationTokens: DelegationTokensFormType
  ldap: LdapFormType
  mtls: MtlsFormType
  
  // Validation state
  validation: ValidationState
}
```

**Actions:**
- `setKafkaAuthMethod(authMethod: string)`
- `setKafkaSecurityProtocol(securityProtocol: string)`
- `setKafkaBootstrapServers(bootstrapServers: string)`
- `setKafkaNoAuth(noAuth: NoAuthFormType)`
- `setKafkaSaslPlain(saslPlain: SaslPlainFormType)`
- `setKafkaSaslJaas(saslJaas: SaslJaasFormType)`
- `setKafkaSaslGssapi(saslGssapi: SaslGssapiFormType)`
- `setKafkaSaslOauthbearer(saslOauthbearer: SaslOauthbearerFormType)`
- `setKafkaSaslScram256(saslScram256: SaslScram256FormType)`
- `setKafkaSaslScram512(saslScram512: SaslScram512FormType)`
- `setKafkaAwsIam(awsIam: AwsIamFormType)`
- `setKafkaDelegationTokens(delegationTokens: DelegationTokensFormType)`
- `setKafkaLdap(ldap: LdapFormType)`
- `setKafkaMtls(mtls: MtlsFormType)`
- `setKafkaConnection(connection: KafkaConnectionFormType)` - Sets entire connection and marks as valid
- `setIsConnected(isConnected: boolean)`
- `getIsKafkaConnectionDirty()` - Checks if connection data has changed
- `resetKafkaStore()` - Resets all Kafka store state

## Schema & Validation

### KafkaConnectionFormSchema

**Location:** `src/scheme/kafka.scheme.ts`

**Purpose:** Defines the Zod schema for form validation using a discriminated union pattern.

**Structure:**
- **Base Schema:** Contains common fields (authMethod, securityProtocol, bootstrapServers)
- **Discriminated Union:** Each auth method extends the base schema with its specific fields
- **Super Refine:** Additional validation for certificate requirements based on security protocol

**Validation Rules:**
1. Base fields are always required
2. Auth-specific fields are required based on selected auth method
3. Truststore certificates are required when:
   - Security protocol is `SASL_SSL` or `SSL`
   - And the auth method supports truststore
4. Certificate validation is handled via `.superRefine()` at the schema level

**Type Safety:**
The discriminated union ensures TypeScript knows which fields are available based on the `authMethod` value, providing compile-time type safety.

## Configuration

### KafkaFormConfig

**Location:** `src/config/kafka-connection-form-config.ts`

**Purpose:** Defines form field configurations for all auth methods.

**Structure:**
- `KafkaBaseFormConfig`: Base form fields (authMethod, securityProtocol, bootstrapServers)
- `KafkaFormConfig`: Auth-specific form configurations
- `KafkaFormDefaultValues`: Default values for all form fields

**Field Configuration:**
Each field includes:
- `name`: Form field name (with nested path for auth-specific fields)
- `label`: Display label
- `placeholder`: Input placeholder text
- `required`: Error message if field is required
- `type`: Field type (text, password, textarea, select, etc.)
- `options`: For select fields

## Connection Flow

### Standard Flow (Pipeline Creation)

1. **Initialization:**
   - Component receives initial values from store
   - Form is initialized with defaults merged with store values
   - User sees base form fields

2. **User Input:**
   - User selects auth method
   - Security protocol auto-selects (if applicable)
   - User fills in auth-specific fields
   - Truststore fields appear if SSL/SASL_SSL is selected

3. **Validation:**
   - Form validates on blur
   - Errors shown only after user interaction
   - Schema validation ensures all required fields are present

4. **Connection Test:**
   - User clicks "Continue"
   - Form validation is triggered
   - If valid, `handleTestConnection` is called
   - Connection test is performed via `useKafkaConnection` hook
   - Analytics events are tracked (started, success/failed)

5. **Save & Proceed:**
   - On successful connection:
     - Connection data is saved to store via `saveConnectionData`
     - All auth method-specific data is saved
     - Store is marked as valid
     - Step is completed via `onCompleteStep`
   - On failed connection:
     - Error is displayed
     - User can fix and retry

### Standalone Flow (Edit Mode)

1. **Initialization:**
   - Form is initialized with existing connection data from store
   - `isReturningToForm` flag is set to `true`
   - Auto-selection is skipped to preserve existing values

2. **User Modifications:**
   - User can modify any connection fields
   - Changes are tracked in form state

3. **Connection Test:**
   - User clicks "Save" or "Continue"
   - Connection is tested with new values
   - On success:
     - New topics are fetched and compared with existing topics
     - If topics changed, dependent sections are invalidated
     - Connection data is saved to store
     - Store is marked as dirty (needs backend sync)
     - Modal/form is closed

4. **Dependent Invalidation:**
   - If topics have changed, the following stores are invalidated:
     - `topicsStore`
     - `joinStore`
     - `deduplicationStore`
     - `clickhouseDestinationStore`
   - This ensures dependent configurations are re-evaluated

## Bootstrap Server Change Detection

The container monitors changes to `bootstrapServers` using a `useRef` to avoid unnecessary re-renders:

```typescript
const previousBootstrapServers = useRef(bootstrapServers)

useEffect(() => {
  if (previousBootstrapServers.current !== bootstrapServers) {
    resetTopicsStore() // Clear topics when source changes
    previousBootstrapServers.current = bootstrapServers
  }
}, [bootstrapServers])
```

When bootstrap servers change, the topics store is reset because topics are specific to a Kafka cluster.

## Analytics Integration

The module tracks analytics events via `useJourneyAnalytics`:

- **Page View:** `analytics.page.setupKafkaConnection()` - When user starts entering connection details
- **Connection Started:** `analytics.kafka.started()` - When connection test begins
- **Connection Success:** `analytics.kafka.success()` - When connection test succeeds
- **Connection Failed:** `analytics.kafka.failed()` - When connection test fails

Analytics events include:
- Auth method used
- Security protocol used
- Connection time (for successful connections)
- Error message (for failed connections)

## API Endpoints

### Test Connection
- **Endpoint:** `POST /ui-api/kafka/`
- **Request Body:** Varies by auth method (see `useKafkaConnection` hook)
- **Response:**
  ```typescript
  {
    success: boolean
    error?: string
  }
  ```

### Fetch Topics
- **Endpoint:** `POST /ui-api/kafka/topics`
- **Request Body:** Similar to test connection request
- **Response:**
  ```typescript
  {
    success: boolean
    topics?: string[]
    error?: string
  }
  ```

## Error Handling

1. **Form Validation Errors:**
   - Displayed inline with form fields
   - Only shown after user interaction
   - Managed by React Hook Form

2. **Connection Test Errors:**
   - Displayed via notification system
   - Error message shown in connection result
   - User can retry after fixing issues

3. **Topic Fetch Errors:**
   - In standalone mode, if topic fetch fails during save:
     - Conservative approach: Dependent sections are invalidated
     - Ensures data consistency

## File Uploads

The module supports file uploads for:
- **Kerberos Keytab:** Base64 encoded, for SASL/GSSAPI
- **krb5.conf:** Text file, for SASL/GSSAPI
- **Certificates:** Text/PEM format, for truststore

File uploads use the `InputFile` and `CertificateFileUpload` components, which:
- Read file content
- Store content in form state
- Store filename separately
- Support both file upload and manual paste

## Dependencies

### Internal Dependencies
- `@/src/store` - Global state management
- `@/src/scheme` - Form schemas and types
- `@/src/config` - Form configurations and constants
- `@/src/hooks` - Custom hooks (useKafkaConnection, useJourneyAnalytics, usePipelineActions)
- `@/src/components/ui` - UI components (FormGroup, form rendering utilities)
- `@/src/components/common` - Common components (InputFile, CertificateFileUpload)

### External Dependencies
- `react-hook-form` - Form state management
- `@hookform/resolvers/zod` - Zod schema validation
- `zustand` - State management
- `react` - React hooks and components

## Best Practices

1. **State Management:**
   - Always use store actions to update Kafka connection state
   - Don't directly mutate store state
   - Use `setKafkaConnection` for bulk updates

2. **Form Validation:**
   - Let React Hook Form handle validation
   - Use Zod schema for type-safe validation
   - Show errors only after user interaction

3. **Connection Testing:**
   - Always test connection before saving
   - Show loading state during connection test
   - Provide clear error messages

4. **Standalone Mode:**
   - Check for topic changes before invalidating dependents
   - Mark store as dirty when changes are made
   - Don't auto-save in standalone mode

5. **Analytics:**
   - Track all connection attempts
   - Include relevant context (auth method, protocol)
   - Track both success and failure cases

## Future Improvements

1. **Connection Caching:**
   - Cache successful connections
   - Reuse connection info when possible

2. **Connection Validation:**
   - Validate connection before allowing form submission
   - Show connection status indicator

3. **Advanced Error Handling:**
   - More specific error messages
   - Retry mechanisms
   - Connection timeout handling

4. **Performance:**
   - Debounce connection tests
   - Optimize re-renders
   - Lazy load form variants
